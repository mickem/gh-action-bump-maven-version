## gh-action-bump-maven-version

GitHub Action for automated maven version bump.

This Action bumps the version in pom.xml and push it back to the repo. 
It can be used on every successful push to main and will ensure version is updated
before a build happens.

Somewhat inspired by gh-action-bump-version.

### Sample workflow

```yaml
on:
  push:
    branches:
      - 'main'

jobs:
  deploy:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v2
        with:
          token: ${{ secrets.GH_LOGIN_TOKEN }}
          ref: ${{ github.head_ref }}
      - name: Set up Java
        uses: actions/setup-java@v1
        with:
          java-version: 11
      - name: Bump version
        id: bump
        uses: mickem/gh-action-bump-maven-version
      - name: Deploy project
        if: steps.bump.outputs.bumped == false
        run: mvn deploy
```
* Based on the commit messages, increment the version from the latest release.
  * If the string "BREAKING CHANGE" is found anywhere in any of the commit messages or descriptions the major 
    version will be incremented.
  * If a commit message begins with the string "feat" then the minor version will be increased. This works
    for most common commit metadata for feature additions: `"feat: new API"` and `"feature: new API"`.
  * All other changes will increment the patch version.
* Push the bumped version in pom.xml back into the repo.
* Push a tag for the new version back into the repo.
* Optionally use the flag to cancel build instead building on the new commit

### Usage:

**pom-file:** Where to find the pom file in case it is not in the root folder.
```yaml
- uses:  'mickem/gh-action-bump-maven-version'
  with:
    pom-file:  'some-folder/pom.xml'
```
**bump-command:** The command used to update the version (usually maven version plugin).
@NEW_VERSION@ will be replaced by the new version and @OLD_VERSION@ will be replaced by the old version.
```yaml
- uses:  'mickem/gh-action-bump-maven-version'
  with:
    bump-command: mvn org.codehaus.mojo:versions-maven-plugin:2.7:set-property -Dproperty=revision -DnewVersion=@NEW_VERSION@
```
**version-path:** Path to version in pom file if you are not using the default version
```yaml
- uses:  'mickem/gh-action-bump-maven-version'
  with:
    version-path: /project/properties/revision
```
**commit-message:** The commit message top use when bumping versions
```yaml
- uses:  'mickem/gh-action-bump-maven-version'
  with:
    commit-message: Bump the version
```
