# Physics

Static physics demos (HTML/JS) ready for GitHub Pages.

How to push and host on GitHub Pages

1. Initialize and push the repository (run these locally):

```bash
git init
git add .
git commit -m "Prepare repo for GitHub Pages deployment"
git branch -M main
git remote add origin https://github.com/Amritesh/Physics.git
git push -u origin main
```

2. After you push, GitHub Actions will run and deploy the site to the `gh-pages` branch.
   The site will be available at: https://amritesh.github.io/Physics/

Notes
- If you prefer to publish from the `main` branch root, you can change the repository's Pages settings on GitHub.
- For a custom domain, add a `CNAME` file at the repo root.
