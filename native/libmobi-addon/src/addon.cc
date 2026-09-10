#include <napi.h>
#include "libmobi_bridge.h"

static Napi::Object ParseToIr(const Napi::CallbackInfo& info) {
  Napi::Env env = info.Env();
  if (info.Length() < 1 || !info[0].IsString()) {
    Napi::TypeError::New(env, "parseToIr(path: string)").ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  std::string path = info[0].As<Napi::String>().Utf8Value();
  ParseResult parsed = libmobi_parse_file(path);

  if (parsed.drm) {
    Napi::Error::New(env, "DRM").ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }
  if (!parsed.ok) {
    Napi::Error::New(env, parsed.error.empty() ? "parse failed" : parsed.error)
        .ThrowAsJavaScriptException();
    return Napi::Object::New(env);
  }

  Napi::Object out = Napi::Object::New(env);
  out.Set("title", Napi::String::New(env, parsed.title));
  out.Set("author", Napi::String::New(env, parsed.author));
  out.Set("language", Napi::String::New(env, parsed.language));
  out.Set("drm", Napi::Boolean::New(env, false));

  Napi::Array chapters = Napi::Array::New(env, parsed.chapters.size());
  for (size_t i = 0; i < parsed.chapters.size(); i++) {
    Napi::Object ch = Napi::Object::New(env);
    ch.Set("id", Napi::String::New(env, parsed.chapters[i].id));
    ch.Set("title", Napi::String::New(env, parsed.chapters[i].title));
    ch.Set("html", Napi::String::New(env, parsed.chapters[i].html));
    chapters.Set(i, ch);
  }
  out.Set("chapters", chapters);

  Napi::Array assets = Napi::Array::New(env, parsed.assets.size());
  for (size_t i = 0; i < parsed.assets.size(); i++) {
    Napi::Object a = Napi::Object::New(env);
    a.Set("href", Napi::String::New(env, parsed.assets[i].href));
    a.Set("mediaType", Napi::String::New(env, parsed.assets[i].mediaType));
    a.Set("data", Napi::String::New(env, parsed.assets[i].dataBase64));
    assets.Set(i, a);
  }
  out.Set("assets", assets);
  return out;
}

static Napi::Object Init(Napi::Env env, Napi::Object exports) {
  exports.Set("parseToIr", Napi::Function::New(env, ParseToIr));
  return exports;
}

NODE_API_MODULE(libmobi_addon, Init)
