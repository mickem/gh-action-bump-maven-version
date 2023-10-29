const {Toolkit} = require('actions-toolkit')
const core = require('@actions/core')
const pomParser = require('pom-parser')
const semver = require('semver')

async function parsePom(pomFile) {
    return await new Promise((resolve, reject) => {
        pomParser.parse({filePath: pomFile}, (err, pomResponse) => {
            if (err) {
                reject(err);
            }
            resolve(pomResponse);
        });
    })
        .catch(err => {
            throw err
        })
}

function getVersionCommand(messages) {
    if (messages.map(message => message.includes('BREAKING CHANGE')).includes(true)) {
        return 'major';
    } else if (messages.map(
        message => message.toLowerCase().startsWith('feat')).includes(true)) {
        return 'minor';
    }
    return 'patch';

}

function fetchPath(obj, path) {
    let trail = ''
    for (const p of path) {
        if (obj === undefined || !obj.hasOwnProperty(p)) {
            throw `Failed to find ${p} from ${trail} when looking for version`;
        }
        trail += `/${p}`;
        obj = obj[p];
    }
    return obj;
}
Toolkit.run(async tools => {
    const event = tools.context.payload

    const commitMessage = process.env['INPUT_COMMIT-MESSAGE'] || 'version bump'
    const tagPrefix = process.env['INPUT_TAG-PREFIX'] || ''

    const messages = event.commits ? event.commits.map(commit => commit.message + '\n' + commit.body) : []
    const isVersionBump = messages.map(message => message.toLowerCase().includes(commitMessage)).includes(true)
    if (isVersionBump) {
        tools.exit.success('Version already bumped!')
        core.setOutput('bumped', false)
        return
    }

    const versionCommand = getVersionCommand(messages)

    try {
        const pomFile = (process.env['INPUT_POM-FILE'] != null) ? process.env['INPUT_POM-FILE'] : 'pom.xml'
        const bumpCommand = (process.env['INPUT_BUMP-COMMAND'] != null) ? process.env['INPUT_BUMP-COMMAND'] : 'mvn org.codehaus.mojo:versions-maven-plugin:set -DnewVersion=@NEW_VERSION@'
        const versionPath = (process.env['INPUT_VERSION-PATH'] != null) ? process.env['INPUT_VERSION-PATH'] : '/project/version'
        const version = (process.env['INPUT_VERSION'] != null) ? process.env['INPUT_VERSION'] : ''

        const pom = await parsePom(pomFile);
        const oldVersion = fetchPath(pom.pomObject, versionPath.split('/').filter(f => f.length > 0));
        const newVersion = version == '' ? semver.inc(oldVersion, versionCommand) : version;
        if (newVersion === undefined || newVersion === null) {
            tools.exit.failure(`Failed to find new version from ${oldVersion} given ${versionCommand}`);
            return;
        }
        console.log(`Bumping version from ${oldVersion} to ${newVersion}`);

        await tools.exec('git', ['config', 'user.name', `"${process.env.GITHUB_USER || 'Automated Version Bump'}"`])
        await tools.exec('git', ['config', 'user.email', `"${process.env.GITHUB_EMAIL || 'gh-action-bump-maven-version@users.noreply.github.com'}"`])

        const command = bumpCommand.replace('@OLD_VERSION@', oldVersion).replace('@NEW_VERSION@', newVersion)
        const commandArray = command.split(' ')
        const cmd = commandArray[0]
        const args = commandArray.splice(1)
        console.log('Running:', cmd, args);
        await tools.exec(cmd, args)
        await tools.exec('git', ['commit', '-a', '-m', `ci: ${commitMessage} ${newVersion}`])

        const remoteRepo = `https://${process.env.GITHUB_ACTOR}:${process.env.GITHUB_TOKEN}@github.com/${process.env.GITHUB_REPOSITORY}.git`
        console.log(Buffer.from(remoteRepo).toString('base64'))
        await tools.exec('git', ['tag', tagPrefix+newVersion])
        await tools.exec('git', ['push', remoteRepo])
        await tools.exec('git', ['push', remoteRepo, '--tags'])
        core.setOutput('tag', tagPrefix+newVersion)
        core.setOutput('bumped', true)
    } catch (e) {
        tools.log.fatal(e)
        tools.exit.failure('Failed to bump version')
    }
    tools.exit.success('Version bumped!')
})