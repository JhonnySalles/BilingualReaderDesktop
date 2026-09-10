#include "libmobi_bridge.h"

#if defined(HAS_LIBMOBI)
#include "mobi.h"
#include <cstdlib>
#include <cstring>

namespace {

std::string b64_encode(const unsigned char* data, size_t len) {
  static const char* tbl =
      "ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789+/";
  std::string out;
  out.reserve(((len + 2) / 3) * 4);
  for (size_t i = 0; i < len; i += 3) {
    unsigned int n = static_cast<unsigned int>(data[i]) << 16;
    if (i + 1 < len) n |= static_cast<unsigned int>(data[i + 1]) << 8;
    if (i + 2 < len) n |= static_cast<unsigned int>(data[i + 2]);
    out.push_back(tbl[(n >> 18) & 63]);
    out.push_back(tbl[(n >> 12) & 63]);
    out.push_back((i + 1 < len) ? tbl[(n >> 6) & 63] : '=');
    out.push_back((i + 2 < len) ? tbl[n & 63] : '=');
  }
  return out;
}

std::string xml_escape(const std::string& s) {
  std::string o;
  o.reserve(s.size());
  for (char c : s) {
    switch (c) {
      case '&': o += "&amp;"; break;
      case '<': o += "&lt;"; break;
      case '>': o += "&gt;"; break;
      default: o += c; break;
    }
  }
  return o;
}

const char* ret_msg(MOBI_RET ret) {
  switch (ret) {
    case MOBI_SUCCESS: return "success";
    case MOBI_ERROR: return "error";
    case MOBI_PARAM_ERR: return "param";
    case MOBI_DATA_CORRUPT: return "corrupt";
    case MOBI_FILE_NOT_FOUND: return "not found";
    case MOBI_FILE_ENCRYPTED: return "encrypted";
    case MOBI_MALLOC_FAILED: return "malloc";
    default: return "unknown";
  }
}

}  // namespace

ParseResult libmobi_parse_file(const std::string& path) {
  ParseResult r;
  MOBIData* m = mobi_init();
  if (!m) {
    r.error = "mobi_init failed";
    return r;
  }

  MOBI_RET ret = mobi_load_filename(m, path.c_str());
  if (ret != MOBI_SUCCESS) {
    if (ret == MOBI_FILE_ENCRYPTED || mobi_is_encrypted(m)) {
      r.drm = true;
      r.error = "DRM";
    } else {
      r.error = std::string("mobi_load_filename: ") + ret_msg(ret);
    }
    mobi_free(m);
    return r;
  }

  if (mobi_is_encrypted(m)) {
    r.drm = true;
    r.error = "DRM";
    mobi_free(m);
    return r;
  }

  char* title = mobi_meta_get_title(m);
  if (title) {
    r.title = title;
    free(title);
  }
  char* author = mobi_meta_get_author(m);
  if (author) {
    r.author = author;
    free(author);
  }
  char* lang = mobi_meta_get_language(m);
  if (lang) {
    r.language = lang;
    free(lang);
  }
  if (r.title.empty()) r.title = "Untitled";

  MOBIRawml* rawml = mobi_init_rawml(m);
  if (!rawml) {
    r.error = "mobi_init_rawml failed";
    mobi_free(m);
    return r;
  }

  ret = mobi_parse_rawml(rawml, m);
  if (ret != MOBI_SUCCESS) {
    r.error = std::string("mobi_parse_rawml: ") + ret_msg(ret);
    mobi_free_rawml(rawml);
    mobi_free(m);
    return r;
  }

  size_t part_i = 0;
  if (rawml->markup) {
    MOBIPart* part = rawml->markup;
    while (part) {
      if (part->data && part->size > 0) {
        IrChapter ch;
        ch.id = "c" + std::to_string(part_i + 1);
        ch.title = "Chapter " + std::to_string(part_i + 1);
        ch.html.assign(reinterpret_cast<char*>(part->data), part->size);
        r.chapters.push_back(ch);
        part_i++;
      }
      part = part->next;
    }
  }

  if (r.chapters.empty() && rawml->flow) {
    MOBIPart* part = rawml->flow;
    std::string html;
    while (part) {
      if (part->data && part->size > 0) {
        html.append(reinterpret_cast<char*>(part->data), part->size);
      }
      part = part->next;
    }
    if (!html.empty()) {
      IrChapter ch;
      ch.id = "c1";
      ch.title = r.title;
      ch.html = html;
      r.chapters.push_back(ch);
    }
  }

  if (rawml->resources) {
    size_t ai = 0;
    MOBIPart* part = rawml->resources;
    while (part) {
      if (part->data && part->size > 0) {
        IrAsset a;
        std::string ext = "bin";
        std::string mt = "application/octet-stream";
        if (part->type == T_JPG) {
          ext = "jpg";
          mt = "image/jpeg";
        } else if (part->type == T_PNG) {
          ext = "png";
          mt = "image/png";
        } else if (part->type == T_GIF) {
          ext = "gif";
          mt = "image/gif";
        }
        a.href = "res_" + std::to_string(ai) + "." + ext;
        a.mediaType = mt;
        a.dataBase64 = b64_encode(part->data, part->size);
        r.assets.push_back(a);
        ai++;
      }
      part = part->next;
    }
  }

  if (r.chapters.empty()) {
    IrChapter ch;
    ch.id = "c1";
    ch.title = r.title;
    ch.html = "<p>" + xml_escape(r.title) + "</p><p>(conteúdo não extraído)</p>";
    r.chapters.push_back(ch);
  }

  mobi_free_rawml(rawml);
  mobi_free(m);
  r.ok = true;
  return r;
}

#else

ParseResult libmobi_parse_file(const std::string& path) {
  (void)path;
  ParseResult r;
  r.error =
      "libmobi sources not vendored. Run scripts/fetch-libmobi.ps1 and yarn build:native";
  return r;
}

#endif
