#pragma once

#include <string>
#include <vector>

struct IrChapter {
  std::string id;
  std::string title;
  std::string html;
};

struct IrAsset {
  std::string href;
  std::string mediaType;
  std::string dataBase64;
};

struct ParseResult {
  bool ok = false;
  bool drm = false;
  std::string error;
  std::string title;
  std::string author;
  std::string language;
  std::vector<IrChapter> chapters;
  std::vector<IrAsset> assets;
};

/** Parse MOBI/AZW via libmobi when HAS_LIBMOBI is defined; otherwise returns error. */
ParseResult libmobi_parse_file(const std::string& path);
