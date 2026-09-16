// ---------------------------------------------------------------------------
// Dialogue lines, grouped by beat id. The story director plays these; friends
// speak from wherever they are standing (spatialised whisper-free audio).
// speaker: 'kabir' | 'meera' | 'rohan' | 'arjun' | 'system' | 'entity'
// ---------------------------------------------------------------------------

export const DIALOGUE = {
  intro: [
    { s: 'rohan', t: 'Raat ke gyarah baj rahe hain. School band hai pichle saat saal se. Hum yahan kya kar rahe hain?' },
    { s: 'kabir', t: 'Dar gaye tu? Main pehle aa raha hoon.' },
    { s: 'meera', t: 'Logic dekho. Band school = koi nahi andar. Koi nahi andar = kuch nahi hoga. Safe.' },
    { s: 'rohan', t: 'Ye logic ulta hai, Meera.' },
    { s: 'arjun', t: 'Ek photo andar se. Bas. Paanch minute.' },
  ],
  gate_lock: [
    { s: 'system', t: 'The gate slams behind you. Something throws two bolts from the inside.' },
    { s: 'kabir', t: '...tu ne khola tha?' },
    { s: 'arjun', t: 'Nahi.' },
    { s: 'rohan', t: 'MOISTURE. Old schools, moisture, gravity. Doors fall closed. Physics. I read things.' },
  ],
  announcement: [
    { s: 'entity', t: 'Good evening, students. Your last period begins now.' },
    { s: 'meera', t: 'Ye speaker dead hain. Isme current kahan se aaya?' },
    { s: 'rohan', t: 'Please mat pucho. Please.' },
  ],
  ch1_goal: [{ s: 'meera', t: 'Lights nahi hain, toh generator chahiye. Bijli wapas layenge toh darwaza bhi khulega, shayad.' }],
  gen_help: [{ s: 'kabir', t: 'Generator ke paas teen cheezein hain — breaker, valve, aur ek start lever. Koi toh pehle try kare?' }],
  gen_done: [
    { s: 'system', t: 'The building exhales. Lights wake up, one corridor at a time.' },
    { s: 'rohan', t: 'Okay. Okay! Lights hain, gate khulta hai ab—' },
  ],
  first_event: [
    { s: 'system', t: 'Every light in the corridor flickers — twice — in the same direction.' },
    { s: 'meera', t: 'That was not a surge. A surge is random. That was... counted.' },
    { s: 'kabir', t: 'Kaun hai?! Bhai tu kaun hai!' },
    { s: 'rohan', t: 'Guys... humare peeche koi hai.' },
  ],
  turn_nobody: [
    { s: 'system', t: 'You turn. Nobody.' },
    { s: 'arjun', t: 'Rohan. Ye mazaak nahi hai.' },
    { s: 'rohan', t: 'Maine mazaak nahi kiya. Main kab se nahi kar raha.' },
  ],
  door_open: [
    { s: 'system', t: 'Ahead of you, a classroom door opens by itself, very slowly.' },
    { s: 'arjun', t: 'Rohan?' },
    { s: 'system', t: 'A silhouette in the doorway. It listens to you. Then it is not there.' },
    { s: 'kabir', t: 'Arjun. Peeche mat dekhna. Bas... peeche mat dekhna.' },
    { s: 'rohan', t: '(from right behind you) ...bhai. Main yahan hoon.' },
  ],
  ch2_goal: [{ s: 'meera', t: 'Reception ka drawer abhi locked hai. Store room mein key milti hai — yaad hai, hum aate waqt gate ke paas se guzre the?' }],
  register_read: [
    { s: 'system', t: 'Attendance Register — Class 9, Period 6. 12 Nov 1998. The paper is dry and new. Impossible.' },
    { s: 'meera', t: 'Ye... ye humare naam hain. Hum chaaron ke.' },
    { s: 'kabir', t: 'Aur humne kabhi is school mein padhai nahi ki.' },
    { s: 'rohan', t: 'Aakhri line. Aakhri line kya hai wo.' },
    { s: 'system', t: 'A fifth name, pressed in so hard the pen tore the page:  UNKNOWN — Status: PRESENT.' },
  ],
  drawer_open: [
    { s: 'system', t: 'Inside the drawer: a torch with batteries, and a 1998 staff list. One name has been inked over.' },
    { s: 'meera', t: 'Staff list pe ink — "H.M. Dutta" ke neeche likha hai "resigned same night". Doosre din order aaya ki usne resignation di hi nahi.' },
  ],
  ch3_goal: [{ s: 'meera', t: 'Board pe sawaal hai, jawab nahi. Char kunchiyan hain — matlab char ankgan. Poore school mein likhe honge. Hum baant lete hain.' }],
  board_read: [{ s: 'system', t: 'On the blackboard, in chalk that is not dusty yet:\n\nWHERE IS THE MISSING STUDENT?' }],
  digit_found: [{ s: 'meera', t: 'Ek ankgan mil gaya. Panel chaar maangta hai — abhi {n}/4.' }],
  panel_wrong: [{ s: 'system', t: 'The panel refuses. Dust falls off the bookcase behind it.' }],
  panel_right: [
    { s: 'system', t: 'Four digits. 1998. The wall bookcase swings inward on a hinge nobody oiled in twenty years.' },
    { s: 'kabir', t: 'Iske peeche seedhiyan hain. Neeche. Plan mat poochho, main khud nahi jaanta.' },
    { s: 'meera', t: 'Ruko. Sab pehle clue utha lo. Ye school tab tak kuch nahi karta, jab tak hum kuch nahi padhte.' },
  ],
  ch4_goal: [{ s: 'meera', t: 'Basement. Records wahan hain. Jo bhi hua, uska kagaz wahi rahega.' }],
  basement_enter: [
    { s: 'rohan', t: 'Ye... ye floor map mein nahi tha.' },
    { s: 'meera', t: 'Nahi tha. Isliye toh ye floor kabhi band nahi hua.' },
  ],
  first_appearance: [
    { s: 'system', t: 'At the far end of the basement, something is standing exactly where the dark is thickest.' },
    { s: 'system', t: 'It is a boy. School uniform. Shoes polished. He has been standing there since 1998.' },
    { s: 'kabir', t: 'BHAGO.' },
  ],
  chase_run: [{ s: 'meera', t: 'Woh darwaza band hai —Records room! Wahan se kuch milega, key, kuch bhi! Bhago, main rasta dikha rahi hoon!' }],
  chase_hide: [{ s: 'kabir', t: 'Almari! Locker mein ghuso! Wo tumhe dekhe bina nahi jaanta — chhup jao!' }],
  chase_lost: [{ s: 'system', t: 'Its footsteps lose the floor. The corridor is only corridor again.' }],
  chase_key: [{ s: 'rohan', t: 'Key! Deewar pe key thi! Fuse room ka main handle — use kaat do, tab tak ye rok do!' }],
  fuse_pulled: [
    { s: 'system', t: 'You pull the main fuse sideways. Every light in the school dies at once, and the building stops holding its breath.' },
    { s: 'meera', t: 'Records. Jitni records tum padhoge, utna uske paas rahega. Ab jaao — gate khula hai.' },
  ],
  final_room: [
    { s: 'system', t: 'Four chairs. One teacher desk. One blackboard. One register. It was set for us before we were born.' },
    { s: 'rohan', t: 'Main nahi baithunga. Main kasam se nahi—' },
    { s: 'kabir', t: 'Baithna padega toh baithenge. Saath mein.' },
  ],
  attendance: [
    { s: 'entity', t: 'Attendance.' },
    { s: 'entity', t: 'Kabir —' },
    { s: 'system', t: 'Kabir sits up straight. A voice that is not his answers for him.' },
    { s: 'entity', t: 'Present.' },
    { s: 'entity', t: 'Meera —' },
    { s: 'entity', t: 'Present.' },
    { s: 'entity', t: 'Rohan —' },
    { s: 'entity', t: 'Present.' },
    { s: 'entity', t: '{playerName} —' },
  ],
  choice: [
    { s: 'meera', t: 'Ruko. Agar hum aaj ye register jalaa dein, toh record khatam. Record gaya toh uska waqt khatam.' },
    { s: 'kabir', t: 'Aur agar hum bas chale gaye? Toh kal koi aur aayega. Agle saal. Aise hi.' },
  ],
  scared: [{ s: 'rohan', t: 'PEECHE! PEECHE HAI WO!' }],
  caught: [{ s: 'system', t: 'Cold fingers close on your collar. The corridor tilts. You are thrown back to your friends, gasping.' }],
  safe: [{ s: 'kabir', t: 'Theek hai? Sab theek? ...sab theek hain?' }],
  hint_no_power: [{ s: 'meera', t: 'Kuch nahi hoga. Pehle power.' }],
  ending_escape: [
    'You get out. Morning is already grey and polite, and there are police cars, and a man with a clipboard asking the same four questions to four people who cannot agree on anything.',
    'Nobody finds a body. Nobody finds a basement.',
    'The register is found on the reception desk, open, undamaged by rain or by twenty years. The officer turns it over twice, then shrugs, and writes in his own notebook.',
    'In the old register, under Class 9 — Period 6, 12 Nov 1998, four new names are written in a child\'s handwriting.',
    'Status: PRESENT. Status: PRESENT. Status: PRESENT. Status: PRESENT.',
  ],
  ending_trapped: [
    'The sun comes up over a school that is completely empty.',
    'The gate is unlocked. It was always unlocked. The corridor is clean. The generator is cold, and full of dust that took twenty years to settle.',
    'In the room with no number, four chairs are arranged in a neat row, facing a teacher desk, facing a blackboard.',
    'On the desk the register is open at 12 Nov 1998, Period 6. Below the line that says UNKNOWN — PRESENT, four new lines have been added in a careful, patient hand.',
    'The ink is still wet.',
  ],
  ending_secret_reveal: [
    'You carry the file, the ledger page, the diary, the reel, the receipt and the shoes up through the hidden room, out of the gate, into the street, into the light.',
    'You do not run. That is the whole trick. Nobody had ever carried it out of the building in daylight, so nobody ever left.',
    'The truth is small and human and worse than the ghost: four adults decided that a missing boy was more expensive than a lying one, and they wrote a word in a register to make it cheap.',
    'When the last photocopy leaves the copier, the loudspeaker in the corridor plays one more announcement. It is not a threat.',
    '"Class dismissed."',
    'Somewhere behind the generator room, a boy who has been standing since 1998 sits down. The period ends.',
  ],
  ending_secret_leave: [
    'You leave the register exactly where it is. You leave the file, and the reel, and the shoes.',
    'You tell yourselves it is not your town\'s secret to spend, and you are almost believable.',
    'The gate opens for you because you never looked back — and it closes behind you for the same reason.',
    'Years later, some kids will dare each other to go in, and one of them will find a register with a page that has four names on it, in handwriting they almost recognise.',
    'You will not be there. That is the ending you chose. It is not a good one, but it is yours.',
  ],
};
