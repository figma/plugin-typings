#!/usr/bin/env bash

set -xueo pipefail

rm -rf test-artifacts
mkdir -p test-artifacts
pushd test-artifacts

cat > package.json << EOF
{}
EOF

cat > tsconfig.json << EOF
{
  "compilerOptions": {
    "target": "es6",
    "lib": ["es6"],
    "typeRoots": [
      "./node_modules/@types",
      "./node_modules/@figma"
    ]
  }
}
EOF

cat > code.ts << EOF
/**
 * Test file to make sure that plugin-typings work as expected.
 */
function main() {
  // figma globals is there
  if (figma.command && figma.editorType) {
    // console.log works
    console.log(figma.root, figma.currentPage)

    // setTimeout works
    setTimeout(() => {
      figma.currentPage.selection = [];
    }, 100)

    // setInterval works too
    clearTimeout(setInterval(() => {
      figma.ui.onmessage = msg => {}
    }, 100))
  }
}

function testErrorFn(): void {
  // @ts-expect-error
  if (figma.NON_EXISTENT_ATTR) {
  }
}

// Node types are available as globals
function testFn1(node: SceneNode): node is FrameNode {
  return node.type === 'FRAME'
}

// Paint types are available as globals too
function testFn(paint: SolidPaint | GradientPaint | ImagePaint | null): boolean {
  return !!paint
}
EOF


npm install typescript
npm install ../
npx tsc --noEmit

popd
