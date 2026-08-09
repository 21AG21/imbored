/* Word Guess. Five letters and not many goes. */
(function () {
  'use strict';
  const { h, pick } = Engine;

  const WORDS = ('about above abuse actor acute admit adopt adult after again agent agree ahead alarm album alert alike alive allow alone along alter among anger angle angry apart apple apply arena argue arise armed array arrow aside asset avoid awake award aware badly baker bases basic basis beach began begin begun being below bench birth black blame blank blast blind block blood board boost booth bound brain brand brass brave bread break breed brief bring broad broke brown brush build built burst buyer cable cabin cameo candy canal cargo carry catch cause chain chair chalk chaos charm chart chase cheap check chess chest chief child china chose civil claim class clean clear clerk click cliff climb clock close cloth cloud coach coast could count court cover crack craft crash crazy cream crime cross crowd crown crude curve cycle daily dance dated dealt death debut delay dense depth doing doubt dozen draft drama drank drawn dream dress dried drink drive drove dying eager early earth eight elite empty enemy enjoy enter entry equal error event every exact exist extra faith false fault favor feast fewer field fifth fifty fight final first fixed flame flash fleet flesh float flood floor flour fluid focus force forge forth forty forum found frame fraud fresh front frost fruit fully funny giant given giver glass globe glory going grace grade grain grand grant grape graph grass grave great green greet grief grill grind gross group grove grown guard guess guest guide happy harsh haste hatch heart heavy hedge hello hence hobby honey honor horse hotel house human humor hurry ideal image imply index inner input irony issue japan joint judge juice knife knock known label labor lakes large laser later laugh layer learn lease least leave legal lemon level lever light limit linen links liver lobby local lodge logic loose lorry lower loyal lucky lunar lunch magic major maker maple march match maybe mayor meant medal media mercy merge merit metal meter might minor minus mixed model money month moral motor mount mouse mouth movie music naked nasty naval nerve never newly night noble noise north noted novel nurse ocean offer often olive onion opera orbit order organ other ought ounce outer owner ozone paint panel panic paper party pasta patch pause peace peach pearl pedal penny phase phone photo piano picky piece pilot pinch pitch pixel pizza place plain plane plant plate point polar porch pound power press price pride prime print prior prize probe promo proof proud prove pulse punch pupil purse quest queue quick quiet quilt quite quota radar radio raise rally ranch range rapid ratio reach react ready realm rebel refer reign relax relay renew repay reply rider ridge rifle right rigid rinse risky rival river roast robot rocky rough round route royal rugby ruler rumor rural sadly saint salad sales salon sandy sauce scale scare scene scent scope score scout scrap screw sense serve seven shade shaft shake shall shame shape share sharp sheep sheet shelf shell shift shine shirt shock shoot shore short shown sight silly since sixth sixty skill skirt slate sleep slice slide slope small smart smell smile smoke snack snake sneak solar solid solve sorry sound south space spare spark speak speed spell spend spent spice spike spine spite split spoke spoon sport spray squad stack staff stage stain stair stake stamp stand stare start state steam steel steep steer stern stick stiff still stock stone stood store storm story stove strap straw strip stuck study stuff style sugar suite sunny super surge sweat sweep sweet swift swing sword table taken tally tango taste teach teeth tempo tenth thank theft their theme there these thick thief thing think third those three threw throw thumb tiger tight timer tired title toast today token tooth topic total touch tough tower toxic trace track trade trail train trait trash treat trend trial tribe trick tried tries truck truly trunk trust truth twice twist ultra uncle under union unite unity until upper upset urban usage usual valid value valve vapor vault venue verse video vigor villa virus visit vital vivid vocal voice voter wagon waist waste watch water weary wedge weigh weird whale wheat wheel where which while white whole whose widen widow width witch woman world worry worse worst worth would wound wrist write wrong yield young yours youth zebra').split(' ');

  const LEN = 5;
  const KEYS = ['qwertyuiop', 'asdfghjkl', '↵zxcvbnm⌫'];

  function mount(root, api) {
    const bagg = Engine.bag();
    const ROWS = api.dm > 2 ? 4 : api.dm > 1.2 ? 5 : 6;
    let answer, guesses, cur, done, streak;

    streak = api.load('streak', 0);
    const pStreak = api.pill('Streak: ' + streak);
    const boardEl = h('div', { class: 'wg-board' });
    const kbEl = h('div', { class: 'wg-kb' });
    const banner = h('div', { class: 'banner', style: { display: 'none' } });
    root.append(boardEl, kbEl, banner);

    const tiles = [];
    for (let r = 0; r < ROWS; r++) {
      const row = h('div', { class: 'wg-row' });
      tiles.push([]);
      for (let c = 0; c < LEN; c++) {
        const t = h('div', { class: 'wg-tile' });
        tiles[r].push(t);
        row.appendChild(t);
      }
      boardEl.appendChild(row);
    }

    const keyEls = {};
    KEYS.forEach((rowStr) => {
      const row = h('div', { class: 'kbd-row' });
      for (const ch of rowStr) {
        const wide = ch === '↵' || ch === '⌫';
        const b = h('button', {
          class: 'kbd-key' + (wide ? ' wide' : ''), type: 'button',
          onclick: () => input(ch === '↵' ? 'Enter' : ch === '⌫' ? 'Backspace' : ch)
        }, ch === '↵' ? 'enter' : ch === '⌫' ? 'del' : ch);
        if (!wide) keyEls[ch] = b;
        row.appendChild(b);
      }
      kbEl.appendChild(row);
    });

    api.button('New word', () => reset(true));
    api.button('Give up', () => {
      if (done) return;
      done = true;
      streak = 0;
      api.save('streak', 0);
      finish(false);
    });

    function reset(breakStreak) {
      if (breakStreak && !done && guesses && guesses.length) { streak = 0; api.save('streak', 0); }
      answer = pick(WORDS);
      guesses = [];
      cur = '';
      done = false;
      banner.style.display = 'none';
      for (const row of tiles) for (const t of row) { t.className = 'wg-tile'; t.textContent = ''; }
      for (const k in keyEls) keyEls[k].className = 'kbd-key';
      pStreak.textContent = 'Streak: ' + streak;
      api.status('Six tries. Green = right letter, right spot. Yellow = right letter, wrong spot.');
    }

    function scoreGuess(guess) {
      const res = new Array(LEN).fill('miss');
      const left = {};
      for (let i = 0; i < LEN; i++) {
        if (guess[i] === answer[i]) res[i] = 'hit';
        else left[answer[i]] = (left[answer[i]] || 0) + 1;
      }
      for (let i = 0; i < LEN; i++) {
        if (res[i] === 'hit') continue;
        if (left[guess[i]] > 0) { res[i] = 'near'; left[guess[i]]--; }
      }
      return res;
    }

    const RANK = { miss: 0, near: 1, hit: 2 };

    function submitGuess() {
      if (cur.length !== LEN) return shake();
      if (!WORDS.includes(cur)) { api.status('“' + cur + '” is not in this word list.'); return shake(); }
      const r = guesses.length;
      const res = scoreGuess(cur);
      guesses.push(cur);
      res.forEach((v, i) => {
        setTimeout(() => {
          tiles[r][i].className = 'wg-tile ' + v;
          const k = keyEls[cur[i]];
          if (k) {
            const now = k.dataset.state || 'none';
            if (RANK[v] >= (RANK[now] === undefined ? -1 : RANK[now])) {
              k.dataset.state = v;
              k.className = 'kbd-key ' + v;
            }
          }
          api.sfx.blip(v === 'hit' ? 720 : v === 'near' ? 520 : 300);
        }, i * 110);
      });
      const won = cur === answer;
      cur = '';
      api.status('');
      if (won || guesses.length === ROWS) {
        done = true;
        if (won) { streak++; api.save('streak', streak); api.submit(streak); }
        else { streak = 0; api.save('streak', 0); }
        pStreak.textContent = 'Streak: ' + streak;
        setTimeout(() => finish(won), 700);
      }
    }

    function finish(won) {
      api.sfx[won ? 'great' : 'bad']();
      banner.style.display = '';
      banner.replaceChildren(
        h('h3', null, won ? ['Got it in ', guesses.length, guesses.length === 1 ? ' try.' : ' tries.'] : 'Out of tries.'),
        h('p', null, won
          ? 'Streak: ' + streak + '. Best streak: ' + (api.best() || streak) + '.'
          : 'The word was “' + answer.toUpperCase() + '”. Streak reset.'),
        h('button', { class: 'btn primary', type: 'button', onclick: () => reset(false) }, 'Next word'));
    }

    function shake() {
      const row = tiles[guesses.length];
      if (!row) return;
      row.forEach((t) => {
        t.classList.remove('shake');
        void t.offsetWidth;
        t.classList.add('shake');
      });
      api.sfx.bad();
    }

    function paintCurrent() {
      const r = guesses.length;
      if (r >= ROWS) return;
      for (let i = 0; i < LEN; i++) {
        tiles[r][i].textContent = cur[i] || '';
        tiles[r][i].className = 'wg-tile' + (cur[i] ? ' filled' : '');
      }
    }

    function input(key) {
      if (done) return;
      if (key === 'Enter') return submitGuess();
      if (key === 'Backspace') { cur = cur.slice(0, -1); return paintCurrent(); }
      if (/^[a-zA-Z]$/.test(key) && cur.length < LEN) { cur += key.toLowerCase(); paintCurrent(); }
    }

    bagg.add(Engine.onKey((e) => {
      if (e.ctrlKey || e.metaKey || e.altKey) return;
      if (e.key === 'Enter' || e.key === 'Backspace' || /^[a-zA-Z]$/.test(e.key)) {
        input(e.key);
        return true;
      }
    }));

    reset(false);
    return () => bagg.dispose();
  }

  Arcade.register({
    id: 'wordguess',
    title: 'Word Guess',
    emoji: 'wordguess',
    cat: 'brain',
    order: 21,
    blurb: 'Guess the hidden five-letter word in six tries, with unlimited rounds and no daily wait.',
    scoreLabel: 'Best streak',
    usesLetters: true,
    tags: ['words', 'wordle', 'vocabulary'],
    how: [
      'Type a five-letter word and press Enter.',
      'Green marks a correct letter in the right spot. Yellow marks a correct letter in the wrong spot. Grey means the letter is not in the word.',
      'Win to extend your streak. Miss and it resets to zero.',
      'Hard drops you to five guesses and nightmare to four.',
      'Play as many rounds as you like with no daily wait.'
    ],
    mount
  });
})();
