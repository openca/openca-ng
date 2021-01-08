{
  "targets": [
    {
      "target_name": "libpki",
      "sources": [ "addon/libpki.cc" ],
      "include_dirs": [
        "<!@(node -p \"require('node-addon-api').include\")",
	"<!@(libpki-config --include)",
      ],
      "dependencies": [
        "<!@(node -p \"require('node-addon-api').gyp\")"
      ],
      "libraries": [
        "<!@(libpki-config --libs)"
      ],
      "cflags!": [
        "-fno-exceptions",
        "<!@(libpki-config --cflags)"
      ],
      "cflags_cc!": [
        "-fno-exceptions",
        "<!@(libpki-config --cflags)"
      ],
      "ldflags!": [
        "<!@(libpki-config --ldflags)"
      ],
      "defines": ["NAPI_CPP_EXCEPTIONS"]
    }
  ]
}
