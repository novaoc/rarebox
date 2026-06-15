import { assert, ok, read, runEval } from './lib.mjs'

function routeIndex(source, path) {
  return source.indexOf(`path: '${path}'`)
}

runEval('route safety', () => {
  const router = read('src/router/index.js')

  const browse = routeIndex(router, '/sets')
  const pokemon = routeIndex(router, '/sets/pokemon')
  const game = routeIndex(router, '/sets/:game')
  const catchAll = routeIndex(router, '/:pathMatch(.*)*')

  assert(browse !== -1, 'Missing /sets browse route')
  assert(pokemon !== -1, 'Missing explicit /sets/pokemon route')
  assert(game !== -1, 'Missing generic /sets/:game route')
  assert(catchAll !== -1, 'Missing catch-all route')

  assert(browse < pokemon, '/sets should appear before /sets/pokemon for readability')
  assert(pokemon < game, '/sets/pokemon must appear before /sets/:game so the wildcard cannot shadow it')
  assert(game < catchAll, '/sets/:game must appear before catch-all')

  const requiredRoutes = ['/', '/search', '/sets', '/sets/pokemon', '/portfolio/:id', '/shelf/:id', '/settings', '/trade', '/booth']
  for (const path of requiredRoutes) assert(routeIndex(router, path) !== -1, `Missing required route: ${path}`)

  ok('/sets/pokemon outranks /sets/:game')
  ok('required app routes are present')
})
