#!/usr/bin/env bash
set -euo pipefail

PLATFORM_NAMESPACE="yourpaas-system"
DOMAIN=""
EMAIL=""
DATA_DIR="/var/lib/yourpaas"
CHANNEL="stable"
VERSION="latest"
IMAGE_PREFIX="ghcr.io/yourpaas"
MANIFEST_FILE=""
MANIFEST_URL=""
SKIP_K3S="false"
SKIP_CERT_MANAGER="false"
INSTALL_REGISTRY="true"
INSTALL_POSTGRES="true"
YES="false"
COMMAND="install"

usage() {
  cat <<'EOF'
Usage:
  install.sh [install|update|uninstall] [flags]

Flags:
  --domain <hostname>
  --email <email>
  --skip-k3s
  --skip-cert-manager
  --install-registry
  --install-postgres
  --registry-domain <hostname>
  --data-dir <path>
  --channel <channel>
  --version <version>
  --image-prefix <ghcr.io/owner-or-org>
  --manifest-file <path>
  --manifest-url <url>
  --yes
  --purge
EOF
}

while [[ $# -gt 0 ]]; do
  case "$1" in
    install|update|uninstall) COMMAND="$1"; shift ;;
    --domain) DOMAIN="$2"; shift 2 ;;
    --email) EMAIL="$2"; shift 2 ;;
    --skip-k3s) SKIP_K3S="true"; shift ;;
    --skip-cert-manager) SKIP_CERT_MANAGER="true"; shift ;;
    --install-registry) INSTALL_REGISTRY="true"; shift ;;
    --install-postgres) INSTALL_POSTGRES="true"; shift ;;
    --registry-domain) REGISTRY_DOMAIN="$2"; shift 2 ;;
    --data-dir) DATA_DIR="$2"; shift 2 ;;
    --channel) CHANNEL="$2"; shift 2 ;;
    --version) VERSION="$2"; shift 2 ;;
    --image-prefix) IMAGE_PREFIX="${2%/}"; shift 2 ;;
    --manifest-file) MANIFEST_FILE="$2"; shift 2 ;;
    --manifest-url) MANIFEST_URL="$2"; shift 2 ;;
    --yes) YES="true"; shift ;;
    --purge) PURGE="true"; shift ;;
    -h|--help) usage; exit 0 ;;
    *) echo "Unknown argument: $1"; usage; exit 1 ;;
  esac
done

log() { printf '\033[1;34m==>\033[0m %s\n' "$*"; }
fail() {
  printf '\033[1;31mInstallation failed:\033[0m %s\n\n' "$*" >&2
  cat >&2 <<EOF
Try:
  kubectl -n ${PLATFORM_NAMESPACE} get pods
  systemctl status k3s
  journalctl -u k3s -n 100

Then rerun:
  curl -fsSL https://install.yourpaas.dev | bash
EOF
  exit 1
}

require_sudo() {
  if [[ "${EUID}" -ne 0 ]] && ! sudo -n true 2>/dev/null; then
    fail "root or passwordless sudo access is required"
  fi
}

check_os() {
  . /etc/os-release
  case "${ID}:${VERSION_ID}" in
    ubuntu:22.04|ubuntu:24.04|debian:12) ;;
    *)
      cat >&2 <<'EOF'
Unsupported operating system.

Supported:
  Ubuntu 22.04
  Ubuntu 24.04
  Debian 12
EOF
      exit 1
      ;;
  esac
}

check_requirements() {
  local cpu mem disk
  cpu="$(nproc)"
  mem="$(awk '/MemTotal/ { print int($2 / 1024 / 1024) }' /proc/meminfo)"
  disk="$(df -BG / | awk 'NR==2 { gsub("G", "", $4); print $4 }')"
  [[ "$cpu" -ge 2 ]] || fail "at least 2 CPU cores are required"
  [[ "$mem" -ge 2 ]] || fail "at least 2 GB RAM is required"
  [[ "$disk" -ge 20 ]] || fail "at least 20 GB free disk is required"
  command -v curl >/dev/null || fail "curl is required"
}

install_k3s() {
  if command -v k3s >/dev/null; then
    log "K3s already installed: skipping"
    return
  fi
  [[ "$SKIP_K3S" == "true" ]] && { log "K3s skipped by flag"; return; }
  log "Installing single-node K3s"
  curl -sfL https://get.k3s.io | INSTALL_K3S_CHANNEL="$CHANNEL" sh -
}

wait_for_kubernetes() {
  log "Waiting for Kubernetes API"
  for _ in {1..60}; do
    if kubectl get nodes >/dev/null 2>&1; then
      return
    fi
    sleep 2
  done
  fail "K3s API did not become ready"
}

generate_secret() {
  openssl rand -base64 32 | tr -d '\n'
}

platform_manifest() {
  local default_manifest
  default_manifest="$(cd "$(dirname "${BASH_SOURCE[0]}")" 2>/dev/null && pwd)/../infra/k8s/platform.yaml"
  if [[ -n "$MANIFEST_FILE" && -f "$MANIFEST_FILE" ]]; then
    cat "$MANIFEST_FILE"
  elif [[ -f "$default_manifest" ]]; then
    cat "$default_manifest"
  elif [[ -n "$MANIFEST_URL" ]]; then
    curl -fsSL "$MANIFEST_URL"
  else
    fail "platform manifest not found. Run from a cloned repo or pass --manifest-url"
  fi
}

render_platform_manifest() {
  local web_image worker_image
  web_image="${IMAGE_PREFIX}/kp3-web:${VERSION}"
  worker_image="${IMAGE_PREFIX}/kp3-worker:${VERSION}"
  platform_manifest | sed "s#__DOMAIN__#${DOMAIN:-localhost}#g; s#__EMAIL__#${EMAIL:-admin@example.com}#g; s#__VERSION__#${VERSION}#g; s#__WEB_IMAGE__#${web_image}#g; s#__WORKER_IMAGE__#${worker_image}#g"
}

install_platform() {
  local better_auth_secret encryption_key postgres_password registry_password web_image worker_image
  better_auth_secret="$(generate_secret)"
  encryption_key="$(generate_secret)"
  postgres_password="$(generate_secret)"
  registry_password="$(generate_secret)"
  web_image="${IMAGE_PREFIX}/kp3-web:${VERSION}"
  worker_image="${IMAGE_PREFIX}/kp3-worker:${VERSION}"

  log "Creating namespace ${PLATFORM_NAMESPACE}"
  kubectl create namespace "$PLATFORM_NAMESPACE" --dry-run=client -o yaml | kubectl apply -f -

  log "Creating platform secrets"
  kubectl -n "$PLATFORM_NAMESPACE" create secret generic yourpaas-secrets \
    --from-literal=BETTER_AUTH_SECRET="$better_auth_secret" \
    --from-literal=ENCRYPTION_KEY="$encryption_key" \
    --from-literal=POSTGRES_PASSWORD="$postgres_password" \
    --from-literal=REGISTRY_PASSWORD="$registry_password" \
    --dry-run=client -o yaml | kubectl apply -f -

  log "Applying platform manifests"
  kubectl -n "$PLATFORM_NAMESPACE" delete job yourpaas-migrations --ignore-not-found
  kubectl apply -f - <<EOF
$(render_platform_manifest)
EOF

  log "Waiting for platform workloads"
  kubectl -n "$PLATFORM_NAMESPACE" rollout status deploy/yourpaas-web --timeout=180s || fail "dashboard rollout failed"
  kubectl -n "$PLATFORM_NAMESPACE" rollout status deploy/yourpaas-worker --timeout=180s || fail "worker rollout failed"

  cat <<EOF

Your PaaS is ready.

Dashboard:
  ${DOMAIN:+https://$DOMAIN}${DOMAIN:-http://localhost}

Next steps:
  1. Open the dashboard
  2. Create the first Owner account
  3. Create your first project
  4. Deploy from a Git repository
EOF
}

update_platform() {
  log "Updating platform manifests"
  kubectl -n "$PLATFORM_NAMESPACE" delete job yourpaas-migrations --ignore-not-found
  kubectl apply -f - <<EOF
$(render_platform_manifest)
EOF
  kubectl -n "$PLATFORM_NAMESPACE" rollout status deploy/yourpaas-web --timeout=180s
  kubectl -n "$PLATFORM_NAMESPACE" rollout status deploy/yourpaas-worker --timeout=180s
}

uninstall_platform() {
  if [[ "${PURGE:-false}" == "true" && "$YES" != "true" ]]; then
    read -r -p "This will remove platform data and managed namespaces. Type 'purge' to continue: " confirmation
    [[ "$confirmation" == "purge" ]] || exit 1
  fi
  log "Removing platform namespace"
  kubectl delete namespace "$PLATFORM_NAMESPACE" --ignore-not-found
  if [[ "${PURGE:-false}" == "true" ]]; then
    log "Removing managed project namespaces"
    kubectl get ns -l app.kubernetes.io/managed-by=yourpaas -o name | xargs -r kubectl delete
  fi
}

require_sudo
check_os
check_requirements

case "$COMMAND" in
  install) install_k3s; wait_for_kubernetes; install_platform ;;
  update) wait_for_kubernetes; update_platform ;;
  uninstall) wait_for_kubernetes; uninstall_platform ;;
esac
