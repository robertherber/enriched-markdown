#include <vector>

#include "RepairInternal.hpp"

namespace Markdown::RepairHandlers {

using namespace RepairInternal;

namespace {

constexpr std::string_view kOpenerChars = "*_~`=|";

bool isSpaceOrTab(char c) {
  return c == ' ' || c == '\t';
}

std::string_view trimSpaces(std::string_view s) {
  while (!s.empty() && isSpaceOrTab(s.front())) {
    s.remove_prefix(1);
  }
  while (!s.empty() && (isSpaceOrTab(s.back()) || s.back() == '\r')) {
    s.remove_suffix(1);
  }
  return s;
}

std::string_view body(const RepairContext &ctx) {
  return jsTrimEnd(ctx.text());
}

size_t lastLineStart(std::string_view text) {
  const size_t newline = text.rfind('\n');
  return newline == npos ? 0 : newline + 1;
}

void eraseFrom(RepairContext &ctx, std::string_view text, size_t position) {
  while (position > 0 && isSpaceOrTab(text[position - 1])) {
    --position;
  }
  ctx.erase(position);
}

void withholdPartialFence(RepairContext &ctx) {
  const std::string_view text = body(ctx);
  const size_t lineStart = lastLineStart(text);
  size_t depth = 0;
  const std::string_view line = trimSpaces(stripBlockquotes(text.substr(lineStart), depth));
  if (line.empty() || line.size() > 2 || (line[0] != '`' && line[0] != '~') ||
      line.find_first_not_of(line[0]) != npos) {
    return;
  }
  ctx.erase(lineStart);
}

bool isMarkerOnlyLine(std::string_view line) {
  size_t depth = 0;
  const std::string_view rest = trimSpaces(stripBlockquotes(line, depth));
  if (rest.empty()) {
    return depth > 0;
  }
  const char first = rest[0];
  if ((first == '#' || first == '=' || first == '-' || first == '`' || first == '~') &&
      rest.find_first_not_of(first) == npos) {
    return rest.size() <= static_cast<size_t>(first == '#' ? 6 : 2);
  }
  if (depth > 0 && startsWith(rest, "[!") && rest.find(']') == npos) {
    return true;
  }
  const size_t marker = skipListMarker(rest);
  if (marker == npos) {
    return false;
  }
  const std::string_view item = rest.substr(marker);
  if (item.empty()) {
    return true;
  }
  if (!isSpaceOrTab(item[0])) {
    return false;
  }
  const std::string_view checkbox = jsTrimStart(item);
  return checkbox == "[" || checkbox == "[x" || checkbox == "[X";
}

void withholdMarkerLine(RepairContext &ctx) {
  const std::string_view text = body(ctx);
  const size_t lineStart = lastLineStart(text);
  if (!text.empty() && isMarkerOnlyLine(text.substr(lineStart))) {
    ctx.erase(lineStart);
  }
}

bool isFenceLine(std::string_view text, size_t start) {
  if (text.size() - start < 3 || (text[start] != '`' && text[start] != '~') ||
      text.find_first_not_of(text[start], start) != npos) {
    return false;
  }
  return lineBefore(text, start).find_first_not_of(" \t>") == npos;
}

void withholdEmptyOpener(RepairContext &ctx) {
  const std::string_view text = body(ctx);
  size_t start = text.size();
  while (start > 0 && kOpenerChars.find(text[start - 1]) != npos) {
    --start;
  }
  if (start == text.size() || (start > 0 && !isJsWhitespace(codePointBefore(text, start)))) {
    return;
  }
  if (ctx.code().inside(start) || isFenceLine(text, start)) {
    return;
  }
  eraseFrom(ctx, text, start);
}

void withholdImageLabel(RepairContext &ctx) {
  const std::string_view text = body(ctx);
  if (text.empty() || text.back() != ']') {
    return;
  }
  const size_t close = text.size() - 1;
  if (isEscaped(text, close) || ctx.code().inside(close)) {
    return;
  }
  const size_t open = findMatchingOpeningBracket(text, close);
  if (open == npos || open == 0 || text[open - 1] != '!' || isEscaped(text, open - 1) || ctx.code().inside(open) ||
      !ctx.openerCanStillClose(open)) {
    return;
  }
  eraseFrom(ctx, text, open - 1);
}

size_t mathScopeStart(RepairContext &ctx, std::string_view text) {
  size_t start = ctx.lastBlockStart();
  const size_t lineStart = lastLineStart(text);
  size_t depth = 0;
  const std::string_view line = jsTrimStart(stripBlockquotes(text.substr(lineStart), depth));
  if (line.empty() || line[0] != '|') {
    return start;
  }
  for (size_t i = lineStart; i < text.size(); ++i) {
    if (text[i] == '|' && !isEscaped(text, i) && !ctx.code().inside(i)) {
      start = i + 1;
    }
  }
  return start;
}

void withholdUnclosedMath(RepairContext &ctx, bool inlineDollar, bool displayDollar) {
  const std::string_view text = body(ctx);
  if (text.find('$') == npos) {
    return;
  }
  struct Opener {
    size_t index;
    size_t length;
  };
  std::vector<Opener> openers;
  size_t i = mathScopeStart(ctx, text);
  while (i < text.size()) {
    if (text[i] != '$' || isEscaped(text, i) || ctx.code().inside(i)) {
      ++i;
      continue;
    }
    const DollarRun run = dollarRunAt(text, i);
    if ((run.length == 1 && inlineDollar) || (run.length == 2 && displayDollar)) {
      if (run.canClose && !openers.empty() && openers.back().length == run.length) {
        openers.clear();
      } else if (run.canOpen) {
        openers.push_back({i, run.length});
      }
    }
    i += run.length;
  }
  if (!openers.empty()) {
    eraseFrom(ctx, text, openers.back().index);
  }
}

} // namespace

void withhold(RepairContext &ctx, const RepairOptions &options) {
  if (endsInsideFence(ctx.text())) {
    if (options.withholdIncomplete) {
      withholdPartialFence(ctx);
    }
    return;
  }
  const bool math = options.withholdMath && (options.inlineMath || options.displayMath);
  size_t size = 0;
  do {
    size = ctx.text().size();
    if (math) {
      withholdUnclosedMath(ctx, options.inlineMath, options.displayMath);
    }
    if (options.withholdIncomplete) {
      withholdImageLabel(ctx);
      withholdEmptyOpener(ctx);
      withholdMarkerLine(ctx);
    }
  } while (ctx.text().size() != size);
}

} // namespace Markdown::RepairHandlers
