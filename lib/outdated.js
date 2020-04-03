'use strict'

const os = require('os')
const pacote = require('pacote')
const table = require('text-table')
const color = require('ansicolors')
const styles = require('ansistyles')
const npa = require('npm-package-arg')
const pickManifest = require('npm-pick-manifest')

const Arborist = require('@npmcli/arborist')

const npm = require('./npm.js')
const output = require('./utils/output.js')
const ansiTrim = require('./utils/ansi-trim.js')

cmd.usage = 'npm outdated [[<@scope>/]<pkg> ...]'

cmd.completion = require('./utils/completion/installed-deep.js')

/*

1. dir deps
2. git deps
3. file/local deps
4. remote deps

Q:
- what happens to dev deps that are missing?
- is alphabetical order ok?
*/

module.exports = cmd
function cmd(args, silent, cb) {
  if (typeof cb !== 'function') {
    cb = silent
    silent = false
  }
  outdated(args, silent, cb)
    .then(() => cb())
    .catch(cb)
}

async function outdated (args, silent, cb) {
  const opts = npm.flatOptions
  const where = opts.global
    ? globalTop
    : npm.prefix

  const arb = new Arborist({
    ...opts,
    path: where
  })

  const tree = await arb.loadActual()

  const list = await outdated_(tree, {
    ...tree.package.dependencies,
    ...tree.package.devDependencies,
    ...tree.package.optionalDependencies
  })

  // sorts list of outdated deps alphabetically
  const outdated = list.sort((a, b) => a.name.localeCompare(b.name))

  if (
    silent ||
    (outdated.length === 0 && !opts.json)
  ) {
    //return cb(err, outdated)
  }

  if (opts.json) {
    //output(makeJSON(outdated, opts))
  } else if (opts.parseable) {
    //output(makeParseable(outdated, opts))
  } else {
    const outList = outdated.map(x => makePretty(x, opts))
    const outHead = [ 'Package',
      'Current',
      'Wanted',
      'Latest',
      'Location'
    ]

    var outTable = [outHead].concat(outList)

    if (opts.color) {
      outTable[0] = outTable[0].map(function (heading) {
        return styles.underline(heading)
      })
    }

    var tableOpts = {
      align: ['l', 'r', 'r', 'r', 'l'],
      stringLength: function (s) { return ansiTrim(s).length }
    }
    output(table(outTable, tableOpts))
  }

  process.exitCode = outdated.length ? 1 : 0

}

async function outdated_ (tree, deps) {
  const list = []
  const children = tree.children

  for (const dep in deps) {    
    const spec = npa(dep)
  
    try {
      let current = ''
      let path = ''
      const node = children.get(dep)
      const packument = await pacote.packument(spec, { 'prefer-online': true })
      const wanted = pickManifest(packument, deps[dep])
      const latest = pickManifest(packument, 'latest')
      
      if (node) {
        current = node.package.version
        path = node.path
      }

      if (
        !current ||
        current !== wanted.version ||
        wanted.version !== latest.version
      ) {
        list.push({ 
          name: dep,
          path,
          current,
          wanted: wanted.version, 
          latest: latest.version, 
          location: tree.package.name
        })
      }

    } catch (err) {
      if (err.code === 'ETARGET' || err.code === 'E403') {
        // do something
        console.log(err)
      } else {
        console.log(err)
        // also do something
      }
    }
  }

  return list
}

function makePretty (dep, opts) {
  const { name, current, wanted, latest, location } = dep

  const columns = [ 
    name,
    current || 'MISSING',
    wanted,
    latest,
    location || 'global'
  ]

  if (opts.color) {
    columns[0] = color[current === wanted ? 'yellow' : 'red'](columns[0]) // current
    columns[2] = color.green(columns[2]) // wanted
    columns[3] = color.magenta(columns[3]) // latest
  }

  return columns
}

// function makeParseable (list) {
//   return list.map(function (p) {
//     var dep = p[0]
//     var depname = p[1]
//     var dir = dep.path
//     var has = p[2]
//     var want = p[3]
//     var latest = p[4]
//     var type = p[6]

//     var out = [
//       dir,
//       depname + '@' + want,
//       (has ? (depname + '@' + has) : 'MISSING'),
//       depname + '@' + latest
//     ]
//     //if (long) out.push(type, dep.package.homepage)

//     return out.join(':')
//   }).join(os.EOL)
// }

// function makeJSON (list, opts) {
//   var out = {}
//   list.forEach(function (p) {
//     var dep = p[0]
//     var depname = p[1]
//     var dir = dep.path
//     var has = p[2]
//     var want = p[3]
//     var latest = p[4]
//     var type = p[6]
//     if (!opts.global) {
//       dir = path.relative(process.cwd(), dir)
//     }
//     out[depname] = { current: has,
//       wanted: want,
//       latest: latest,
//       location: dir
//     }
//     // if (long) {
//     //   out[depname].type = type
//     //   out[depname].homepage = dep.package.homepage
//     // }
//   })
//   return JSON.stringify(out, null, 2)
// }