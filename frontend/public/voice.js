/**
 * voice.js: drop-in voice activation (speech-to-text + text-to-speech).
 * No dependencies. Works as a plain <script>, or via require()/import in a bundler.
 *
 * QUICK START (plain HTML)
 *   <button id="mic">Speak</button> <input id="box">
 *   <script src="voice.js"></script>
 *   <script>
 *     const voice = createVoice({
 *       lang: 'en-IN',                       // 'ta-IN' Tamil, 'te-IN' Telugu, 'hi-IN' Hindi
 *       onInterim: t => box.value = t,       // live text while the person is talking
 *       onResult:  t => { box.value = t; voice.speak('You said ' + t); },
 *       onError:   msg => alert(msg)
 *     });
 *     voice.bindButton(document.getElementById('mic'));   // click to start/stop
 *   </script>
 *
 * WAKE WORD (hands-free): createVoice({ wakeWord: 'hey namma', onResult: cmd => ... })
 *   Say "hey namma take me to Guindy" -> onResult('take me to guindy').
 *   Say "hey namma" alone -> it waits for the next sentence as the command.
 *   Must be started once from a click (browsers require a user gesture for the mic).
 *   Wake-word text comes back lowercase with punctuation removed.
 *
 * API
 *   voice.start() / voice.stop() / voice.toggle()
 *   voice.speak(text, {lang, rate, pitch}) -> Promise (resolves when speech ends)
 *   voice.stopSpeech()    voice.setLang('ta-IN')    voice.bindButton(btn)
 *   voice.supported -> { listen: bool, speak: bool }
 *   states passed to onState: 'idle' | 'listening' | 'waiting' | 'armed' | 'speaking'
 *
 * NOTES
 *   - Needs HTTPS or http://localhost (browsers block the microphone otherwise).
 *   - Voice input works in Chrome, Edge and Safari. Firefox has no SpeechRecognition;
 *     voice.supported.listen is false there, so hide or disable your mic button.
 *   - Chrome sends the audio to Google's servers for recognition, so it needs internet
 *     and you should mention this in your privacy notice.
 */
(function (root, factory) {
  if (typeof module === 'object' && module.exports) module.exports = factory();
  else root.createVoice = factory();
})(typeof self !== 'undefined' ? self : this, function () {
  'use strict';

  var W = typeof window !== 'undefined' ? window : {};
  var SR = W.SpeechRecognition || W.webkitSpeechRecognition;
  var synth = W.speechSynthesis;

  function createVoice(opts) {
    opts = opts || {};
    var noop = function () {};
    var lang = opts.lang || 'en-IN';
    var wake = opts.wakeWord ? norm(opts.wakeWord) : null;
    var onResult = opts.onResult || noop;
    var onInterim = opts.onInterim || noop;
    var onState = opts.onState || noop;
    var onError = opts.onError || noop;
    var onWake = opts.onWake || noop;
    var state = 'idle';
    var rec = null;
    var wantOn = false;   // the person asked for listening
    var armed = false;    // wake word heard, waiting for the command
    var speaking = false;
    var speakTok = 0;

    function norm(s) {
      return String(s).toLowerCase().replace(/[^\p{L}\p{N} ]/gu, '').replace(/\s+/g, ' ').trim();
    }

    function setState(s) {
      if (s !== state) { state = s; onState(s); }
    }

    function explain(code) {
      if (code === 'not-allowed' || code === 'service-not-allowed')
        return 'Microphone access is blocked. Allow it in the address bar, then try again.';
      if (code === 'audio-capture') return 'No microphone was found.';
      if (code === 'network') return 'Voice input needs an internet connection.';
      if (code === 'language-not-supported') return 'This language is not supported for voice input.';
      return 'Voice input failed (' + code + ').';
    }

    function build() {
      var r = new SR();
      r.lang = lang;
      r.interimResults = true;
      r.continuous = !!wake;
      r.maxAlternatives = 1;
      r.onstart = function () {
        setState(armed ? 'armed' : wake ? 'waiting' : 'listening');
      };
      r.onresult = function (e) {
        var interim = '', final = '', conf = 0;
        for (var i = e.resultIndex; i < e.results.length; i++) {
          var res = e.results[i];
          if (res.isFinal) { final += res[0].transcript; conf = res[0].confidence; }
          else interim += res[0].transcript;
        }
        if (interim) onInterim(interim.trim());
        if (final) handle(final.trim(), conf);
      };
      r.onerror = function (e) {
        if (e.error === 'no-speech' || e.error === 'aborted') return;
        wantOn = false;
        onError(explain(e.error), e.error);
      };
      r.onend = function () {
        if (wantOn && wake && !speaking) { restart(); return; }
        if (!wake) wantOn = false;
        if (!speaking) setState('idle');
      };
      return r;
    }

    function restart() {
      try { rec.start(); } catch (_) { /* already running */ }
    }

    function handle(text, conf) {
      if (!wake) { wantOn = false; onResult(text, conf); return; }
      var n = norm(text), i = n.indexOf(wake);
      if (i >= 0) {
        var cmd = n.slice(i + wake.length).trim();
        if (cmd) { armed = false; setState('waiting'); onResult(cmd, conf); }
        else { armed = true; setState('armed'); onWake(); }
      } else if (armed) {
        armed = false; setState('waiting'); onResult(n, conf);
      }
    }

    function start() {
      if (!SR) {
        onError('Voice input is not supported in this browser. Try Chrome, Edge or Safari.', 'unsupported');
        return false;
      }
      if (wantOn) return true;
      stopSpeech();
      rec = build();
      wantOn = true; armed = false;
      try { rec.start(); }
      catch (e) { wantOn = false; onError(explain('start-failed'), 'start-failed'); return false; }
      return true;
    }

    function stop() {
      wantOn = false; armed = false;
      if (rec) { try { rec.abort(); } catch (_) {} }
      setState('idle');
    }

    function toggle() { if (wantOn) stop(); else start(); }

    var FEMALE = /female|woman|zira|hazel|susan|samantha|victoria|karen|moira|tessa|fiona|veena|heera|priya|lekha|kalpana|shruti|pallavi|neerja|swara|aria|jenny|libby|sonia|google (uk english female|us english)|natasha|catherine|siri/i;
    var MALE = /\bmale\b|david|mark|george|james|ravi|hemant|rishi|prabhat|guy|ryan|daniel|alex|fred/i;
    var voicesReady = false;
    if (synth) {
      try { synth.addEventListener('voiceschanged', function () { voicesReady = true; }); } catch (_) {}
    }

    // Best voice for a language, preferring female voices and local (offline) ones.
    // Score is deterministic so the same voice is picked every time.
    function scoreVoice(v, full, base) {
      var lang = (v.lang || '').toLowerCase().replace('_', '-'), n = v.name || '', sc = 0;
      if (lang === full) sc += 100; else if (lang.indexOf(base) === 0) sc += 60; else return -1;
      if (FEMALE.test(n)) sc += 40;
      if (MALE.test(n) && !FEMALE.test(n)) sc -= 40;
      if (v.localService) sc += 5;
      return sc;
    }

    function pickVoice(l) {
      if (!synth) return null;
      var vs = synth.getVoices(), full = l.toLowerCase().replace('_', '-'), base = full.split('-')[0];
      var best = null, bestScore = -1;
      for (var i = 0; i < vs.length; i++) {
        var sc = scoreVoice(vs[i], full, base);
        if (sc > bestScore) { best = vs[i]; bestScore = sc; }
      }
      return best;
    }

    function stopSpeech() {
      speakTok++;
      speaking = false;
      if (synth) synth.cancel();
    }

    // Speaks in short sentence chunks (Chrome cuts off long utterances).
    // Pauses the microphone while speaking so the app does not hear itself.
    function speak(text, o) {
      o = o || {};
      if (!synth || !text) return Promise.resolve(false);
      stopSpeech();
      var tok = speakTok;
      var parts = String(text).match(/[^.!?\u0964]+[.!?\u0964]*/g) || [String(text)];
      var l = o.lang || lang, v = pickVoice(l), i = 0;
      speaking = true;
      setState('speaking');
      if (rec && wantOn) { try { rec.abort(); } catch (_) {} }
      return new Promise(function (resolve) {
        function finish() {
          resolve(true);
          if (tok !== speakTok) return;
          speaking = false;
          setState('idle');
          if (wantOn && wake) restart();
        }
        (function next() {
          if (tok !== speakTok) { resolve(true); return; }
          if (i >= parts.length) { finish(); return; }
          var chunk = parts[i++].trim();
          if (!chunk) { next(); return; }
          var u = new SpeechSynthesisUtterance(chunk);
          u.lang = l;
          u.rate = o.rate || opts.rate || 1;
          u.pitch = o.pitch || (v && FEMALE.test(v.name) ? 1 : 1.1);
          if (v) u.voice = v;
          u.onend = next;
          u.onerror = finish;
          synth.speak(u);
        })();
      });
    }

    function setLang(l) {
      lang = l;
      if (rec) rec.lang = l;
    }

    function bindButton(btn) {
      if (!SR) { btn.hidden = true; return; }
      btn.setAttribute('aria-pressed', 'false');
      btn.addEventListener('click', toggle);
      var prev = onState;
      onState = function (s) {
        prev(s);
        btn.setAttribute('aria-pressed', String(s === 'listening' || s === 'waiting' || s === 'armed'));
        btn.dataset.state = s;
      };
    }

    return {
      supported: { listen: !!SR, speak: !!synth },
      start: start, stop: stop, toggle: toggle,
      speak: speak, stopSpeech: stopSpeech,
      setLang: setLang, bindButton: bindButton,
      voiceName: function (l) { var v = pickVoice(l || lang); return v ? v.name : null; },
      get state() { return state; }
    };
  }

  return createVoice;
});
