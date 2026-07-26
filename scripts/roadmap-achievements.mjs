import ts from 'typescript'

export function parseAchievementsSource(source) {
  const file = ts.createSourceFile('achievements.ts', source, ts.ScriptTarget.Latest, true, ts.ScriptKind.TS)
  let initializer = null

  const visit = (node) => {
    if (ts.isVariableDeclaration(node) && ts.isIdentifier(node.name) && node.name.text === 'ACHIEVEMENTS') {
      initializer = node.initializer ?? null
      return
    }
    ts.forEachChild(node, visit)
  }
  visit(file)

  if (!initializer || !ts.isArrayLiteralExpression(initializer)) {
    throw new Error('ACHIEVEMENTS must be a static array literal')
  }

  return initializer.elements.map((element, index) => {
    if (!ts.isObjectLiteralExpression(element)) {
      throw new Error(`Achievement ${index + 1} must be a static object literal`)
    }
    return {
      id: stringProperty(element, 'id', index),
      title: stringProperty(element, 'title', index),
      detail: stringProperty(element, 'detail', index),
      category: stringProperty(element, 'category', index),
      tier: stringProperty(element, 'tier', index),
      xp: numberProperty(element, 'xp', index),
      bounty: numberProperty(element, 'bounty', index),
    }
  })
}

function property(object, key, index) {
  const found = object.properties.find((candidate) =>
    ts.isPropertyAssignment(candidate) && propertyName(candidate.name) === key,
  )
  if (!found || !ts.isPropertyAssignment(found)) {
    throw new Error(`Achievement ${index + 1} is missing a static ${key} property`)
  }
  return found.initializer
}

function propertyName(name) {
  if (ts.isIdentifier(name) || ts.isStringLiteralLike(name)) return name.text
  return null
}

function stringProperty(object, key, index) {
  const value = property(object, key, index)
  if (!ts.isStringLiteralLike(value)) {
    throw new Error(`Achievement ${index + 1} ${key} must be a string literal`)
  }
  return value.text
}

function numberProperty(object, key, index) {
  const value = property(object, key, index)
  if (!ts.isNumericLiteral(value)) {
    throw new Error(`Achievement ${index + 1} ${key} must be a number literal`)
  }
  const parsed = Number(value.getText().replaceAll('_', ''))
  if (!Number.isFinite(parsed)) throw new Error(`Achievement ${index + 1} ${key} is not finite`)
  return parsed
}
