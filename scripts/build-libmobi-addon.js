/**
 * Dynamically builds binding config: when vendor/libmobi exists, compile libmobi
 * sources with HAS_LIBMOBI; otherwise compile a stub that reports unavailable at runtime
 * via missing .node or parse errors.
 *
 * Usage: node scripts/build-libmobi-addon.js
 * Optional: ELECTRON_VERSION for electron-rebuild target.
 */
const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const root = path.join(__dirname, '..');
const addonDir = path.join(root, 'native', 'libmobi-addon');
const vendorSrc = path.join(addonDir, 'vendor', 'libmobi', 'src');
const gypPath = path.join(addonDir, 'binding.gyp');

function listLibmobiSources() {
  if (!fs.existsSync(vendorSrc)) return [];
  return fs
    .readdirSync(vendorSrc)
    .filter(f => f.endsWith('.c'))
    .map(f => path.join('vendor', 'libmobi', 'src', f).replace(/\\/g, '/'));
}

function writeBindingGyp(withLibmobi) {
  const sources = ['src/addon.cc', 'src/libmobi_bridge.cc'];
  const defines = ['NAPI_DISABLE_CPP_EXCEPTIONS'];
  const includeDirs = [
    "<!@(node -p \"require('node-addon-api').include\")",
    'src'
  ];

  if (withLibmobi) {
    sources.push(...listLibmobiSources());
    defines.push('HAS_LIBMOBI');
    defines.push('HAVE_CONFIG_H');
    includeDirs.push('vendor/libmobi/src');
    // Our build config (PACKAGE_VERSION, USE_MINIZ, USE_XMLWRITER)
    includeDirs.push('../vendor-config');
    // Also copy-friendly path from addon root
    includeDirs.push('vendor-config');
  }

  // Ensure vendor-config is visible as ../config.h from vendor/libmobi/src/config.h
  // which does: #include "../config.h" when HAVE_CONFIG_H
  const vendorConfigDest = path.join(addonDir, 'vendor', 'libmobi', 'config.h');
  const vendorConfigSrc = path.join(addonDir, 'vendor-config', 'config.h');
  if (withLibmobi && fs.existsSync(vendorConfigSrc)) {
    fs.copyFileSync(vendorConfigSrc, vendorConfigDest);
  }

  const gyp = {
    targets: [
      {
        target_name: 'libmobi_addon',
        cflags: ['-fexceptions'],
        'cflags!': ['-fno-exceptions'],
        'cflags_cc!': ['-fno-exceptions'],
        sources,
        include_dirs: includeDirs,
        defines,
        conditions: [
          [
            "OS=='win'",
            {
              msvs_settings: {
                VCCLCompilerTool: {
                  ExceptionHandling: 1,
                  AdditionalOptions: ['/std:c++17']
                }
              },
              defines: ['_CRT_SECURE_NO_WARNINGS', ...(withLibmobi ? ['HAS_LIBMOBI', 'HAVE_CONFIG_H'] : [])]
            }
          ]
        ]
      }
    ]
  };

  fs.writeFileSync(gypPath, JSON.stringify(gyp, null, 2));
  console.log(
    withLibmobi
      ? `binding.gyp: HAS_LIBMOBI with ${listLibmobiSources().length} libmobi sources`
      : 'binding.gyp: stub (no vendor/libmobi) — adapter will stay unavailable until fetch+rebuild'
  );
}

function main() {
  const withLibmobi = fs.existsSync(path.join(vendorSrc, 'mobi.h'));
  if (!withLibmobi) {
    console.warn(
      'build:native skipped — vendor/libmobi missing (run yarn fetch:libmobi). LibmobiAdapter stays unavailable.'
    );
    process.exitCode = 0;
    return;
  }

  writeBindingGyp(true);

  // Ensure node-addon-api is resolvable from addon dir
  const napiPkg = path.join(addonDir, 'node_modules', 'node-addon-api');
  if (!fs.existsSync(napiPkg)) {
    console.log('Installing native/libmobi-addon deps...');
    const yarn = spawnSync('yarn', ['install'], { cwd: addonDir, shell: true, stdio: 'inherit' });
    if (yarn.status !== 0) {
      console.warn('yarn install in addon failed; trying npm');
      spawnSync('npm', ['install', '--no-fund', '--no-audit'], {
        cwd: addonDir,
        shell: true,
        stdio: 'inherit'
      });
    }
  }

  const electronPkg = path.join(root, 'node_modules', 'electron', 'package.json');
  let electronVersion = process.env.ELECTRON_VERSION;
  if (!electronVersion && fs.existsSync(electronPkg)) {
    electronVersion = JSON.parse(fs.readFileSync(electronPkg, 'utf8')).version;
  }

  const args = ['rebuild', '--release'];
  if (electronVersion) {
    args.push(`--target=${electronVersion}`, '--dist-url=https://electronjs.org/headers');
  }

  console.log('node-gyp', args.join(' '));
  const result = spawnSync('npx', ['node-gyp', ...args], {
    cwd: addonDir,
    shell: true,
    stdio: 'inherit',
    env: { ...process.env }
  });

  if (result.status !== 0) {
    console.warn(
      'build:native failed — LibmobiAdapter will report unavailable; Calibre/Pandoc remain as fallback.'
    );
    process.exitCode = 0; // graceful: do not fail the whole electron build
    return;
  }
  console.log('libmobi-addon built OK');
}

main();
