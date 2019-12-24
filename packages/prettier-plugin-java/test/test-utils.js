/*eslint no-console: ["error", { allow: ["error"] }] */
"use strict";

const prettier = require("prettier");
const { expect } = require("chai");
const { readFileSync, existsSync, removeSync, copySync } = require("fs-extra");
const { resolve, relative, basename } = require("path");
const klawSync = require("klaw-sync");
const { execSync, spawnSync } = require("child_process");

const { createPrettierDoc } = require("../src/cst-printer");
const javaParser = require("java-parser");
const { printDocToString } = require("prettier").doc.printer;

const pluginPath = resolve(__dirname, "../");
function testSample(testFolder, exclusive) {
  const itOrItOnly = exclusive ? it.only : it;
  const inputPath = resolve(testFolder, "_input.java");
  const expectedPath = resolve(testFolder, "_output.java");
  const relativeInputPath = relative(__dirname, inputPath);

  let inputContents;
  let expectedContents;

  before(() => {
    inputContents = readFileSync(inputPath, "utf8");
    expectedContents = readFileSync(expectedPath, "utf8");
  });

  itOrItOnly(`can format <${relativeInputPath}>`, () => {
    const actual = prettier.format(inputContents, {
      parser: "java",
      plugins: [pluginPath]
    });

    expect(actual).to.equal(expectedContents);
  });

  it(`Performs a stable formatting for <${relativeInputPath}>`, () => {
    const onePass = prettier.format(inputContents, {
      parser: "java",
      plugins: [pluginPath]
    });

    const secondPass = prettier.format(onePass, {
      parser: "java",
      plugins: [pluginPath]
    });
    expect(onePass).to.equal(secondPass);
  });
}

function testRepositorySample(testFolder, command, args) {
  describe(`Prettify the repository <${testFolder}>`, () => {
    const testsamples = resolve(__dirname, "../test-samples");
    const samplesDir = resolve(testsamples, basename(testFolder));
    if (existsSync(samplesDir)) {
      removeSync(samplesDir);
    }
    copySync(testFolder, samplesDir);

    const sampleFiles = klawSync(resolve(__dirname, samplesDir), {
      nodir: true
    });
    const javaSampleFiles = sampleFiles.filter(fileDesc =>
      fileDesc.path.endsWith(".java")
    );

    javaSampleFiles.forEach(fileDesc => {
      it(`Performs a stable formatting for <${relative(
        samplesDir,
        fileDesc.path
      )}>`, () => {
        const javaFileText = readFileSync(fileDesc.path, "utf8");

        const onePass = prettier.format(javaFileText, {
          parser: "java",
          plugins: [pluginPath]
        });
        const secondPass = prettier.format(onePass, {
          parser: "java",
          plugins: [pluginPath]
        });
        expect(onePass).to.equal(secondPass);
      });
    });

    it(`verify semantic validity ${testFolder}`, function(done) {
      this.timeout(0);
      const code = spawnSync(command, args, {
        cwd: samplesDir,
        maxBuffer: Infinity
      });
      if (code.status !== 0) {
        expect.fail(
          `Cannot build ${testFolder}, please check the output below:\n ${code.stdout.toString()}`
        );
      }
      done();
    });
  });
}

function formatJavaSnippet(snippet, entryPoint) {
  const node = javaParser.parse(snippet, entryPoint);
  const doc = createPrettierDoc(node);

  return printDocToString(doc, {
    printWidth: 80,
    tabWidth: 2
  }).formatted;
}

function expectSnippetToBeFormatted({ input, expectedOutput, entryPoint }) {
  const onePass = formatJavaSnippet(input, entryPoint);
  const secondPass = formatJavaSnippet(onePass, entryPoint);

  expect(onePass).to.equal(expectedOutput);
  expect(secondPass).to.equal(expectedOutput);
}

function cloneRepoIfNotExists({ repoName, repoUrl, branch }) {
  const samplesDir = resolve(__dirname, "../samples");

  if (!existsSync(resolve(samplesDir, repoName))) {
    // eslint-disable-next-line no-console
    console.log(`cloning ${repoUrl}`);
    execSync(`git clone ${repoUrl} --branch ${branch} --depth 1`, {
      cwd: samplesDir,
      stdio: [0, 1, 2]
    });
  }
}

module.exports = {
  expectSnippetToBeFormatted,
  formatJavaSnippet,
  testSample,
  testRepositorySample,
  cloneRepoIfNotExists
};
