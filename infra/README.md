# Production deployment

The Ubuntu VM runs both application processes behind Nginx without Docker:

- Backend: `127.0.0.1:3000`
- ML API: `127.0.0.1:8001`
- Nginx: public port 80, preserving the static site at `/`

The Backend reads secrets from `/etc/dsm-p5-g02/backend.env`. This file must be
owned by `root:dsmapp`, have mode `0640`, and define at least `MONGODB_URI`.
It is never stored in Git or replaced during deployment.

Run a deployment as the SSH deployment user:

```bash
/opt/dsm-p5-g02/infra/scripts/deploy.sh <git-revision>
```

The script refuses tracked local changes, installs locked dependencies, builds
the Backend, updates systemd and Nginx configuration, restarts both services,
and verifies their local health endpoints.
