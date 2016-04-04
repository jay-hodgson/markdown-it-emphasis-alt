// Process emphasis

'use strict';
// single or double marker is toggled
var isSingleOpen;
var isDoubleOpen;
var newlinePos;
var initialized = false;
function reset(_newlinePos) {
  isSingleOpen = false;
  isDoubleOpen = false;
  if (_newlinePos) {
    newlinePos = _newlinePos;
  } else {
    newlinePos = 0;
  }
}
// Zs (unicode class) || [\t\f\v\r\n]
function isWhiteSpaceOrMarker(code) {
  if (code >= 0x2000 && code <= 0x200A) { return true; }
  switch (code) {
    case 0x09: // \t
    case 0x0A: // \n
    case 0x0B: // \v
    case 0x0C: // \f
    case 0x0D: // \r
    case 0x20:
    case 0xA0:
    case 0x1680:
    case 0x202F:
    case 0x205F:
    case 0x3000:
    case 0x5F:
    case 0x2A:
      return true;
  }
  return false;
}
function tokenize(state, silent) {
  var token,
    lastChar, nextChar,
    start = state.pos,
    marker = state.src.charCodeAt(start),
    isDouble = false,
    nextNewlinePos = start;
  if (silent) { return false; }

  if (marker !== 0x5F /* _ */ && marker !== 0x2A /* * */) { return false; }
  lastChar = start > 0 ? state.src.charCodeAt(start - 1) : 0x20;
  nextChar = state.pos + 1 < state.posMax ? state.src.charCodeAt(state.pos + 1) : 0x20;

  if (!(isWhiteSpaceOrMarker(lastChar)) &&
      !(isWhiteSpaceOrMarker(nextChar))) {
    // this could be a filename
    return false;
  }

  if (start + 1 <= state.posMax) {
    if (state.src.charCodeAt(start + 1) === marker) {
      isDouble = true;
    }
  }
  while (nextNewlinePos < state.posMax) {
    if (state.src.charAt(nextNewlinePos) === '\n') {
      break;
    }
    nextNewlinePos++;
  }
  if (nextNewlinePos > newlinePos) {
    reset(nextNewlinePos);
  }

  token         = state.push('text', '', 0);
  token.content = String.fromCharCode(marker);
  if (isDouble) {
    isDoubleOpen = !isDoubleOpen;
    token.content += String.fromCharCode(marker);
  } else {
    isSingleOpen = !isSingleOpen;
  }

  state.delimiters.push({
    // Char code of the starting marker (number).
    //
    marker: marker,

    // An amount of characters before this one that's equivalent to
    // current one. In plain English: if this delimiter does not open
    // an emphasis, neither do previous `jump` characters.
    //
    // Used to skip sequences like "*****" in one step, for 1st asterisk
    // value will be 0, for 2nd it's 1 and so on.
    //
    jump:   0,

    // A position of the token this delimiter corresponds to.
    //
    token:  state.tokens.length - 1,

    // Token level.
    //
    level:  state.level,

    // If this delimiter is matched as a valid opener, `end` will be
    // equal to its position, otherwise it's `-1`.
    //
    end:    -1,

    // Boolean flags that determine if this delimiter could open or close
    // an emphasis.
    //
    open:   isDouble ? isDoubleOpen : isSingleOpen,
    close:  isDouble ? !isDoubleOpen : !isSingleOpen,
    isDoubleMarker: isDouble
  });
  state.pos++;
  if (isDouble) {
    state.pos++;
  }

  return true;
}

function postProcess(state) {
  var i,
      startDelim,
      endDelim,
      token,
      ch,
      isStrong,
      delimiters = state.delimiters,
      max = state.delimiters.length;

  for (i = 0; i < max; i++) {
    startDelim = delimiters[i];

    if (startDelim.marker !== 0x5F/* _ */ && startDelim.marker !== 0x2A/* * */) {
      continue;
    }

    // Process only opening markers
    if (startDelim.end === -1) {
      continue;
    }

    endDelim = delimiters[startDelim.end];

    isStrong = startDelim.isDoubleMarker;

    ch = String.fromCharCode(startDelim.marker);

    token         = state.tokens[startDelim.token];
    token.type    = isStrong ? 'strong_open' : 'em_open';
    token.tag     = isStrong ? 'strong' : 'em';
    token.nesting = 1;
    token.markup  = isStrong ? ch + ch : ch;
    token.content = '';

    token         = state.tokens[endDelim.token];
    token.type    = isStrong ? 'strong_close' : 'em_close';
    token.tag     = isStrong ? 'strong' : 'em';
    token.nesting = -1;
    token.markup  = isStrong ? ch + ch : ch;
    token.content = '';
  }
}
module.exports = function emphasis_alt(md) {
  reset(0);
  if (!initialized) {
    md.disable('emphasis');
    md.inline.ruler.before('emphasis', 'emphasis_alt', tokenize);
    md.inline.ruler2.before('emphasis', 'emphasis_alt', postProcess);
    initialized = true;
  }
};
