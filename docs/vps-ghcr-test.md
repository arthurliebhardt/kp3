# VPS Test With GHCR

This is the fastest path to test the platform dashboard on a disposable VPS.

## 1. Push images to GHCR

Push this repository to GitHub and run the `Publish GHCR images` workflow.

The workflow publishes:

```txt
ghcr.io/<owner>/korepush-web:latest
ghcr.io/<owner>/korepush-worker:latest
```

For the current installer, make both GHCR packages public or configure Kubernetes image pull secrets manually.

## 2. Point DNS

Create an A record:

```txt
panel.example.com -> <vps-ip>
```

Wait until the VPS resolves it:

```bash
dig +short panel.example.com
```

## 3. Install from a cloned repo

On the VPS:

```bash
git clone https://github.com/<owner>/<repo>.git
cd <repo>
sudo ./scripts/install.sh \
  --domain panel.example.com \
  --email admin@example.com \
  --image-prefix ghcr.io/<owner> \
  --version latest \
  --yes
```

## 4. Install with curl

Use this form if you do not want to clone the repo:

```bash
curl -fsSL https://raw.githubusercontent.com/<owner>/<repo>/main/scripts/install.sh | sudo bash -s -- \
  --domain panel.example.com \
  --email admin@example.com \
  --image-prefix ghcr.io/<owner> \
  --version latest \
  --manifest-url https://raw.githubusercontent.com/<owner>/<repo>/main/infra/k8s/platform.yaml \
  --yes
```

## 5. Inspect install

```bash
kubectl -n yourpaas-system get pods
kubectl -n yourpaas-system logs deploy/yourpaas-web
kubectl -n yourpaas-system logs deploy/yourpaas-worker
kubectl -n yourpaas-system logs job/yourpaas-migrations
kubectl -n yourpaas-system get ingress
```

## Current limitation

This installs the platform dashboard and worker shell. Project deployment is still scaffold-level: the worker records desired manifests and deployment events, but does not yet fully apply runtime resources, run BuildKit, stream build logs, or watch rollouts end-to-end.
