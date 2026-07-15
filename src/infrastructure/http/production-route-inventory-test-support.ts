/** @Acp.Infra.Http.ProductionRouteInventory.TestSupport — static production route inventory */
import { readFileSync } from 'node:fs'
import ts from 'typescript'

const CONVENIENCE_METHODS = {
  get: 'GET',
  post: 'POST',
  patch: 'PATCH',
  put: 'PUT',
  del: 'DELETE',
  head: 'HEAD',
  options: 'OPTIONS',
} as const

const STANDARD_METHODS = new Set([
  'GET',
  'PUT',
  'POST',
  'DELETE',
  'OPTIONS',
  'HEAD',
  'PATCH',
  'TRACE',
])

export const routeKey = (method: string, path: string): string =>
  `${method.toUpperCase()} ${path.replace(/:([A-Za-z0-9_]+)/g, '{$1}')}`

const isV1Path = (path: string): boolean =>
  path === '/v1' || path.startsWith('/v1/')

const httpRouterMember = (expression: ts.Expression): string | undefined => {
  if (!ts.isPropertyAccessExpression(expression)) return undefined
  if (!ts.isIdentifier(expression.expression)) return undefined
  if (expression.expression.text !== 'HttpRouter') return undefined
  return expression.name.text
}

const literalPath = (
  member: string,
  arguments_: ts.NodeArray<ts.Expression>,
): string => {
  const path = arguments_.find(
    (argument) =>
      ts.isStringLiteralLike(argument) && argument.text.startsWith('/'),
  )
  if (path === undefined || !ts.isStringLiteralLike(path)) {
    throw new Error(`HttpRouter.${member} must declare a literal path`)
  }
  return path.text
}

const genericRoute = (
  node: ts.CallExpression,
): { readonly method: string; readonly path: string } | undefined => {
  if (!ts.isCallExpression(node.expression)) return undefined
  const inner = node.expression
  if (httpRouterMember(inner.expression) !== 'route') return undefined

  const path = literalPath('route', node.arguments)
  const methodArgument = inner.arguments.at(0)
  if (methodArgument === undefined || !ts.isStringLiteralLike(methodArgument)) {
    throw new Error('HttpRouter.route must declare a literal HTTP method')
  }
  const method = methodArgument.text.toUpperCase()
  if (!STANDARD_METHODS.has(method)) {
    throw new Error(`HttpRouter.route uses unsupported HTTP method ${method}`)
  }
  return { method, path }
}

export const extractProductionV1RouteKeys = (
  source: string,
): readonly string[] => {
  const sourceFile = ts.createSourceFile(
    'router.ts',
    source,
    ts.ScriptTarget.Latest,
    true,
    ts.ScriptKind.TS,
  )
  const routes: string[] = []

  const visit = (node: ts.Node): void => {
    if (ts.isCallExpression(node)) {
      const generic = genericRoute(node)
      if (generic !== undefined && isV1Path(generic.path)) {
        routes.push(routeKey(generic.method, generic.path))
      }

      const member = httpRouterMember(node.expression)
      if (member === 'all') {
        const path = literalPath(member, node.arguments)
        if (isV1Path(path)) {
          throw new Error('HttpRouter.all cannot declare a typed /v1 operation')
        }
      } else if (member !== undefined && member in CONVENIENCE_METHODS) {
        const path = literalPath(member, node.arguments)
        if (isV1Path(path)) {
          const method =
            CONVENIENCE_METHODS[member as keyof typeof CONVENIENCE_METHODS]
          routes.push(routeKey(method, path))
        }
      }
    }
    ts.forEachChild(node, visit)
  }

  visit(sourceFile)
  return routes.sort()
}

export const productionV1RouteKeys = (): readonly string[] =>
  extractProductionV1RouteKeys(readFileSync('src/app/server/router.ts', 'utf8'))
