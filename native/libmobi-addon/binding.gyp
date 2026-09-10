{
  "targets": [
    {
      "target_name": "libmobi_addon",
      "cflags": [
        "-fexceptions"
      ],
      "cflags!": [
        "-fno-exceptions"
      ],
      "cflags_cc!": [
        "-fno-exceptions"
      ],
      "sources": [
        "src/addon.cc",
        "src/libmobi_bridge.cc",
        "vendor/libmobi/src/buffer.c",
        "vendor/libmobi/src/compression.c",
        "vendor/libmobi/src/debug.c",
        "vendor/libmobi/src/encryption.c",
        "vendor/libmobi/src/index.c",
        "vendor/libmobi/src/memory.c",
        "vendor/libmobi/src/meta.c",
        "vendor/libmobi/src/miniz.c",
        "vendor/libmobi/src/opf.c",
        "vendor/libmobi/src/parse_rawml.c",
        "vendor/libmobi/src/randombytes.c",
        "vendor/libmobi/src/read.c",
        "vendor/libmobi/src/sha1.c",
        "vendor/libmobi/src/structure.c",
        "vendor/libmobi/src/util.c",
        "vendor/libmobi/src/write.c",
        "vendor/libmobi/src/xmlwriter.c"
      ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
        "src",
        "vendor/libmobi/src",
        "../vendor-config",
        "vendor-config"
      ],
      "defines": [
        "NAPI_DISABLE_CPP_EXCEPTIONS",
        "HAS_LIBMOBI",
        "HAVE_CONFIG_H"
      ],
      "conditions": [
        [
          "OS=='win'",
          {
            "msvs_settings": {
              "VCCLCompilerTool": {
                "ExceptionHandling": 1,
                "AdditionalOptions": [
                  "/std:c++17"
                ]
              }
            },
            "defines": [
              "_CRT_SECURE_NO_WARNINGS",
              "HAS_LIBMOBI",
              "HAVE_CONFIG_H"
            ]
          }
        ]
      ]
    }
  ]
}