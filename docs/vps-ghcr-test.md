# VPS Test With GHCR

This is the fastest path to test the platform dashboard on a disposable VPS.

## Install

Run this on a fresh Ubuntu 22.04/24.04 or Debian 12 VPS:

```bash
curl -fsSL https://raw.githubusercontent.com/arthurliebhardt/kp3/main/scripts/install.sh | sudo bash
```

The installer auto-detects the public IP and exposes the dashboard at `http://<server-ip>`.
Create the first user in the browser at `/setup`. Configure a real domain later from the dashboard.

## 1. Push images to GHCR

Push this repository to GitHub and run the `Publish GHCR images` workflow.

The workflow publishes:

```txt
ghcr.io/<owner>/kp3-web:latest
ghcr.io/<owner>/kp3-worker:latest
```

For the current installer, make both GHCR packages public or configure Kubernetes image pull secrets manually.

## 2. Advanced: install from a cloned repo

On the VPS:

```bash
git clone https://github.com/<owner>/<repo>.git
cd <repo>
sudo ./scripts/install.sh
```

## 3. Advanced: install with custom image settings

Use this form if you do not want to clone the repo:

```bash
curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/scripts/install.sh | sudo bash -s -- \
  --image-prefix ghcr.io/<owner> \
  --version latest \
  --manifest-url https://raw.githubusercontent.com/<owner>/<repo>/main/infra/k8s/platform.yaml \
  --yes
```

## 4. Inspect install

```bash
kubectl -n yourpaas-system get pods
kubectl -n yourpaas-system logs deploy/yourpaas-web
kubectl -n yourpaas-system logs deploy/yourpaas-worker
kubectl -n yourpaas-system logs job/yourpaas-migrations
kubectl -n yourpaas-system get ingress
```

## Current limitation

This installs the platform dashboard and worker shell. Project deployment is still scaffold-level: the worker records desired manifests and deployment events, but does not yet fully apply runtime resources, run BuildKit, stream build logs, or watch rollouts end-to-end.
