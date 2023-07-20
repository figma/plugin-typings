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
    "strict": true,
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

function testNotify() {
  figma.notify("normal")
  figma.notify("error", {error: true})
  figma.notify("timeout", {timeout: 10000})
  figma.notify("Infinity", {timeout: Infinity})

  figma.notify("button", {button: {
    text: "button",
    action: () => {
      return false
    }
  }})

  figma.notify("button", {
    button: {
      text: "button",
      action: () => {},
    }
  })

  figma.notify("onDequeue", {
    onDequeue: (reason: NotifyDequeueReason) => {
      switch (reason) {
        case 'timeout':
          break;
        case 'dismiss':
          break;
        case 'action_button_click':
          break;
        default:
          function assertNever(x: never): never {
            throw new Error("Unexpected object: " + x);
          }
          assertNever(reason);
          break;
      }
    }
  })
}

function testCodegen() {
  figma.codegen.on("generate", async () => {
    return [
      {
        language: "TYPESCRIPT",
        code: JSON.stringify(figma.codegen.preferences.unit),
        title: "Code snippet 1"
      },
      {
        language: "JAVASCRIPT",
        code: JSON.stringify(figma.codegen.preferences.scaleFactor),
        title: "Code snippet 2"
      },
      {
        language: "JAVASCRIPT",
        code: JSON.stringify(figma.codegen.preferences.customSettings),
        title: "Code snippet 3"
      }
    ]
  })
}

function testFindAllWithCriteria() {
  const nodes = figma.root.findAllWithCriteria({ types: ["TEXT"] });
  console.log(nodes.map(n => {
    return [n.id, n.characters]
  }))

  const frame = figma.createFrame()
  const nodes2 = frame.findAllWithCriteria({ sharedPluginData: { namespace: 'foo' } })
  console.log(nodes2[0].id)
}

function testParameters() {
  figma.on('run', async ({ command, parameters }) => {
    console.log(command, parameters)
  })
}

EOF


npm install typescript
npm install ../
npx tsc --noEmit

popd
