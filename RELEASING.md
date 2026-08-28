# Releasing macOS Builds

macOS releases are built by GitHub Actions from this repository's packaged BOYNEXTDOOR Pets assets.

## Manual Build

1. Go to GitHub -> Actions -> build-mac.
2. Click Run workflow.
3. Select the branch to build.
4. Download the macOS artifacts from the run summary.

## Tag Release

Push a version tag. For version 1.1.0:

```powershell
git tag v1.1.0
git push origin v1.1.0
```

The workflow builds:

- macOS Apple Silicon dmg/zip
- macOS Intel dmg/zip

Tag builds also publish the artifacts to a GitHub Release.

## Notes

- The macOS artifacts are unsigned and not notarized.
- The workflow uses `npm ci`, so keep `package-lock.json` committed with the
  matching app version.
