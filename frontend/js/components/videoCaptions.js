/**
 * Live caption overlay for the walkthrough video.
 * The video file has no burned-in captions; cues (timings) are loaded from
 * videos/walkthrough_cues.json and the texts below are rendered as HTML
 * overlays styled like the original recording. Language is switchable.
 */

const TEXTS = {
    en: {
        step0: 'Step 0 — Connect Wallet',
        wizard1: 'Step 1 — Choose Type, Category & Title',
        wizard2: 'Step 2 — Select Constitution Text',
        wizard3: 'Step 3 — Propose Changes',
        wizard4: 'Step 4 — Explain',
        wizard5: 'Step 5 — Review & Submit',
        published: 'Published — Discuss & Track',
        c1a: 'Click "Connect Wallet" and choose any Cardano wallet — Eternl, Lace, Vespr, or any CIP-30 wallet. Your stake address becomes your identity — no account or password needed.',
        c2a: 'Once signed in, open Proposals and click "New Proposal". Choose CAP, pick a category, and give your proposal a clear title.',
        c2b: 'In Step 2, read the Constitution and highlight the exact passage you want to change. Choose "Replace" to swap the wording for new text.',
        c2c: 'When needed, choose "Add After" to insert new text after a selected passage without removing the original wording.',
        c3a: 'For each selection, write your proposed text — the replacement wording, or the new text to insert after the passage.',
        c3b: 'Then explain your proposal: a short summary, why the change is needed, and its expected impact.',
        c3c: 'Step 5 previews exactly how your proposal will look once published. Review it, then click "Submit Proposal".',
        c4a: 'Your proposal is now live and open for consultation — its category, author, and review period visible to everyone.',
        c4b: 'Add a comment to join the discussion, and track the proposal through its lifecycle: consultation, ready, and done.',
    },
    ja: {
        badge1: "ステップ 1 / 4 — ウォレット接続",
        badge2: "ステップ 2 / 4 — 閲覧と選択",
        badge3: "ステップ 3 / 4 — 提出",
        badge4: "ステップ 4 / 4 — 議論と追跡",
        c1a: "「Connect Wallet」をクリックし、任意のCardanoウォレット（Eternl、Lace、Vespr、その他CIP-30対応ウォレット）を選びます。ステークアドレスがあなたのIDになり、アカウントもパスワードも不要です。",
        c2a: "サインインしたら「New CAP」をクリックして提案フォームを開きます。CAPを選び、カテゴリを選択し、提案に分かりやすいタイトルを付けます。",
        c2b: "ステップ2では、憲法を読み、変更したい箇所を選択します。「Replace」を選ぶと、その文言を新しいテキストに置き換えられます。",
        c2c: "別の箇所を選択し、「Add After」を選ぶと、元の文言を残したまま、その直後に新しいテキストを挿入できます。",
        c3a: "各選択について、提案するテキストを記入します。置き換える文言、または後ろに挿入する新しいテキストです。",
        c3b: "続いて提案の理由を説明します。短い要約、変更が必要な理由、そして想定される影響です。",
        c3c: "ステップ5では、公開後の提案の見え方がそのままプレビューされます。確認して「Submit Proposal」をクリックします。",
        c4a: "提案は公開され、協議期間に入ります。カテゴリ、作成者、レビュー期限が全員に表示されます。",
        c4b: "コメントを追加して議論に参加し、協議・準備完了・完了というライフサイクルを通じて提案を追跡できます。",
    },
    es: {
        badge1: "Paso 1 de 4 — Conectar cartera",
        badge2: "Paso 2 de 4 — Explorar y seleccionar",
        badge3: "Paso 3 de 4 — Enviar",
        badge4: "Paso 4 de 4 — Debatir y seguir",
        c1a: "Haz clic en «Connect Wallet» y elige cualquier cartera de Cardano —Eternl, Lace, Vespr o cualquiera compatible con CIP-30—. Tu dirección de staking es tu identidad: sin cuenta ni contraseña.",
        c2a: "Una vez dentro, haz clic en «New CAP» para abrir el formulario de propuesta. Elige CAP, selecciona una categoría y dale un título claro a tu propuesta.",
        c2b: "En el Paso 2, lee la Constitución y resalta el pasaje exacto que quieres cambiar. Elige «Replace» para sustituir el texto por uno nuevo.",
        c2c: "Resalta otro pasaje y elige «Add After» para insertar texto nuevo justo después, sin eliminar el original.",
        c3a: "Para cada selección, escribe tu texto propuesto: la nueva redacción de reemplazo o el texto que se insertará tras el pasaje.",
        c3b: "Después explica tu propuesta: un breve resumen, por qué es necesario el cambio y su impacto previsto.",
        c3c: "El Paso 5 muestra exactamente cómo se verá tu propuesta una vez publicada. Revísala y haz clic en «Submit Proposal».",
        c4a: "Tu propuesta ya está publicada y abierta a consulta, con su categoría, autor y periodo de revisión visibles para todos.",
        c4b: "Añade un comentario para unirte al debate y sigue la propuesta por su ciclo: consulta, lista y finalizada.",
    },
    de: {
        badge1: "Schritt 1 von 4 — Wallet verbinden",
        badge2: "Schritt 2 von 4 — Durchsuchen & Auswählen",
        badge3: "Schritt 3 von 4 — Einreichen",
        badge4: "Schritt 4 von 4 — Diskutieren & Verfolgen",
        c1a: "Klicke auf „Connect Wallet“ und wähle eine beliebige Cardano-Wallet – Eternl, Lace, Vespr oder eine andere CIP-30-Wallet. Deine Stake-Adresse ist deine Identität – ganz ohne Konto oder Passwort.",
        c2a: "Klicke nach dem Anmelden auf „New CAP“, um das Vorschlagsformular zu öffnen. Wähle CAP, eine Kategorie und gib deinem Vorschlag einen klaren Titel.",
        c2b: "Lies in Schritt 2 die Verfassung und markiere die genaue Stelle, die du ändern möchtest. Wähle „Replace“, um den Wortlaut durch neuen Text zu ersetzen.",
        c2c: "Markiere eine weitere Stelle und wähle „Add After“, um direkt danach neuen Text einzufügen – ohne den ursprünglichen Wortlaut zu entfernen.",
        c3a: "Schreibe für jede Auswahl deinen Textvorschlag – den Ersatztext oder den neuen Text, der nach der Stelle eingefügt wird.",
        c3b: "Erkläre anschließend deinen Vorschlag: eine kurze Zusammenfassung, warum die Änderung nötig ist, und ihre erwartete Wirkung.",
        c3c: "Schritt 5 zeigt genau, wie dein Vorschlag nach der Veröffentlichung aussieht. Prüfe ihn und klicke auf „Submit Proposal“.",
        c4a: "Dein Vorschlag ist jetzt live und zur Konsultation geöffnet – Kategorie, Autor und Prüfzeitraum sind für alle sichtbar.",
        c4b: "Füge einen Kommentar hinzu, um mitzudiskutieren, und verfolge den Vorschlag durch seinen Lebenszyklus: Konsultation, bereit und abgeschlossen.",
    },
    vi: {
        badge1: "Bước 1/4 — Kết nối ví",
        badge2: "Bước 2/4 — Duyệt & Chọn",
        badge3: "Bước 3/4 — Gửi",
        badge4: "Bước 4/4 — Thảo luận & Theo dõi",
        c1a: "Nhấp «Connect Wallet» và chọn bất kỳ ví Cardano nào — Eternl, Lace, Vespr hoặc bất kỳ ví tương thích CIP-30 nào. Địa chỉ stake của bạn chính là danh tính — không cần tài khoản hay mật khẩu.",
        c2a: "Sau khi đăng nhập, nhấp «New CAP» để mở biểu mẫu đề xuất. Chọn CAP, chọn một danh mục và đặt tiêu đề rõ ràng cho đề xuất.",
        c2b: "Ở Bước 2, đọc Hiến pháp và bôi chọn đúng đoạn bạn muốn thay đổi. Chọn «Replace» để thay từ ngữ hiện có bằng văn bản mới.",
        c2c: "Bôi chọn một đoạn khác và chọn «Add After» để chèn văn bản mới ngay sau đó — mà không xóa nội dung gốc.",
        c3a: "Với mỗi lựa chọn, viết nội dung đề xuất của bạn — phần thay thế, hoặc văn bản mới chèn sau đoạn đó.",
        c3b: "Sau đó giải thích đề xuất: tóm tắt ngắn gọn, lý do cần thay đổi, và tác động dự kiến.",
        c3c: "Bước 5 xem trước chính xác đề xuất sẽ hiển thị thế nào sau khi đăng. Kiểm tra rồi nhấp «Submit Proposal».",
        c4a: "Đề xuất của bạn đã đăng và mở để tham vấn — danh mục, tác giả và thời hạn xem xét hiển thị cho mọi người.",
        c4b: "Thêm bình luận để tham gia thảo luận và theo dõi đề xuất qua vòng đời: tham vấn, sẵn sàng và hoàn tất.",
    },
    id: {
        badge1: "Langkah 1 dari 4 — Hubungkan Dompet",
        badge2: "Langkah 2 dari 4 — Jelajahi & Pilih",
        badge3: "Langkah 3 dari 4 — Kirim",
        badge4: "Langkah 4 dari 4 — Diskusi & Pantau",
        c1a: "Klik «Connect Wallet» dan pilih dompet Cardano apa pun — Eternl, Lace, Vespr, atau dompet lain yang kompatibel dengan CIP-30. Alamat stake Anda menjadi identitas Anda — tanpa akun atau kata sandi.",
        c2a: "Setelah masuk, klik «New CAP» untuk membuka formulir usulan. Pilih CAP, pilih kategori, dan beri judul yang jelas.",
        c2b: "Pada Langkah 2, baca Konstitusi dan sorot bagian tepat yang ingin Anda ubah. Pilih «Replace» untuk mengganti teks lama dengan teks baru.",
        c2c: "Sorot bagian lain dan pilih «Add After» untuk menyisipkan teks baru tepat setelahnya — tanpa menghapus teks aslinya.",
        c3a: "Untuk setiap pilihan, tulis teks usulan Anda — teks pengganti, atau teks baru yang disisipkan setelah bagian itu.",
        c3b: "Lalu jelaskan usulan Anda: ringkasan singkat, mengapa perubahan diperlukan, dan dampak yang diharapkan.",
        c3c: "Langkah 5 menampilkan pratinjau persis seperti tampilan usulan setelah dipublikasikan. Tinjau, lalu klik «Submit Proposal».",
        c4a: "Usulan Anda kini tayang dan terbuka untuk konsultasi — kategori, penulis, dan periode tinjauan terlihat oleh semua orang.",
        c4b: "Tambahkan komentar untuk bergabung dalam diskusi, dan pantau usulan melalui siklusnya: konsultasi, siap, dan selesai.",
    },
    pt: {
        badge1: "Passo 1 de 4 — Conectar carteira",
        badge2: "Passo 2 de 4 — Explorar & Selecionar",
        badge3: "Passo 3 de 4 — Enviar",
        badge4: "Passo 4 de 4 — Debater & Acompanhar",
        c1a: "Clique em «Connect Wallet» e escolha qualquer carteira Cardano — Eternl, Lace, Vespr ou outra compatível com CIP-30. O seu endereço de stake passa a ser a sua identidade — sem conta nem senha.",
        c2a: "Depois de entrar, clique em «New CAP» para abrir o formulário de proposta. Escolha CAP, selecione uma categoria e dê um título claro à proposta.",
        c2b: "No Passo 2, leia a Constituição e destaque o trecho exato que deseja alterar. Escolha «Replace» para substituir o texto por um novo.",
        c2c: "Destaque outro trecho e escolha «Add After» para inserir um novo texto logo após ele — sem remover o texto original.",
        c3a: "Para cada seleção, escreva o texto proposto — a nova redação de substituição ou o texto a inserir após o trecho.",
        c3b: "Depois explique a sua proposta: um breve resumo, por que a mudança é necessária e o impacto esperado.",
        c3c: "O Passo 5 mostra exatamente como a proposta ficará depois de publicada. Revise e clique em «Submit Proposal».",
        c4a: "A sua proposta já está publicada e aberta a consulta — categoria, autor e período de revisão visíveis para todos.",
        c4b: "Adicione um comentário para participar do debate e acompanhe a proposta pelo seu ciclo: consulta, pronta e concluída.",
    },
    fr: {
        badge1: "Étape 1 sur 4 — Connecter le portefeuille",
        badge2: "Étape 2 sur 4 — Parcourir & Sélectionner",
        badge3: "Étape 3 sur 4 — Soumettre",
        badge4: "Étape 4 sur 4 — Discuter & Suivre",
        c1a: "Cliquez sur « Connect Wallet » et choisissez n'importe quel portefeuille Cardano — Eternl, Lace, Vespr ou tout portefeuille compatible CIP-30. Votre adresse de stake devient votre identité — sans compte ni mot de passe.",
        c2a: "Une fois connecté, cliquez sur « New CAP » pour ouvrir le formulaire de proposition. Choisissez CAP, sélectionnez une catégorie et donnez un titre clair à votre proposition.",
        c2b: "À l'étape 2, lisez la Constitution et surlignez le passage exact à modifier. Choisissez « Replace » pour remplacer le texte existant par un nouveau.",
        c2c: "Surlignez un autre passage et choisissez « Add After » pour insérer un nouveau texte juste après — sans supprimer le texte d'origine.",
        c3a: "Pour chaque sélection, rédigez votre texte proposé — le texte de remplacement ou le nouveau texte à insérer après le passage.",
        c3b: "Expliquez ensuite votre proposition : un bref résumé, pourquoi le changement est nécessaire et son impact attendu.",
        c3c: "L'étape 5 prévisualise exactement l'aspect de votre proposition une fois publiée. Vérifiez, puis cliquez sur « Submit Proposal ».",
        c4a: "Votre proposition est désormais en ligne et ouverte à la consultation — catégorie, auteur et période d'examen visibles par tous.",
        c4b: "Ajoutez un commentaire pour participer à la discussion et suivez la proposition tout au long de son cycle : consultation, prête et terminée.",
    },
    ko: {
        badge1: "4단계 중 1단계 — 지갑 연결",
        badge2: "4단계 중 2단계 — 탐색 및 선택",
        badge3: "4단계 중 3단계 — 제출",
        badge4: "4단계 중 4단계 — 토론 및 추적",
        c1a: "“Connect Wallet”을 클릭하고 원하는 Cardano 지갑(Eternl, Lace, Vespr 또는 CIP-30 호환 지갑)을 선택하세요. 스테이크 주소가 신원이 되며, 계정이나 비밀번호가 필요 없습니다.",
        c2a: "로그인한 뒤 “New CAP”을 클릭해 제안 양식을 엽니다. CAP을 선택하고 카테고리를 고른 다음 제안에 명확한 제목을 붙입니다.",
        c2b: "2단계에서 헌법을 읽고 변경하려는 정확한 구절을 선택합니다. “Replace”를 선택하면 기존 문구를 새 텍스트로 바꿉니다.",
        c2c: "다른 구절을 선택하고 “Add After”를 고르면 원래 문구를 지우지 않고 바로 뒤에 새 텍스트를 삽입합니다.",
        c3a: "각 선택 항목에 대해 제안할 텍스트를 작성합니다. 대체할 문구이거나 구절 뒤에 삽입할 새 텍스트입니다.",
        c3b: "그런 다음 제안 이유를 설명합니다. 짧은 요약, 변경이 필요한 이유, 예상되는 영향입니다.",
        c3c: "5단계에서는 게시 후 제안이 어떻게 보일지 그대로 미리 봅니다. 검토한 뒤 “Submit Proposal”을 클릭합니다.",
        c4a: "제안이 이제 게시되어 협의가 시작됩니다. 카테고리, 작성자, 검토 기간이 모두에게 표시됩니다.",
        c4b: "댓글을 달아 토론에 참여하고, 협의·준비·완료로 이어지는 수명 주기를 통해 제안을 추적하세요.",
    },
    zh: {
        badge1: "第 1 步（共 4 步）— 连接钱包",
        badge2: "第 2 步（共 4 步）— 浏览与选择",
        badge3: "第 3 步（共 4 步）— 提交",
        badge4: "第 4 步（共 4 步）— 讨论与跟踪",
        c1a: "点击“Connect Wallet”，选择任意 Cardano 钱包 — Eternl、Lace、Vespr 或任何兼容 CIP-30 的钱包。你的质押地址即为身份，无需账户或密码。",
        c2a: "登录后，点击“New CAP”打开提案表单。选择 CAP，挑选类别，并为提案取一个清晰的标题。",
        c2b: "在第 2 步，阅读宪法并选中你想修改的确切段落。选择“Replace”，用新文本替换原有措辞。",
        c2c: "选中另一段落并选择“Add After”，即可在其后插入新文本，同时保留原有措辞。",
        c3a: "为每一处选择撰写提案文本 — 替换的措辞，或要插入到段落之后的新文本。",
        c3b: "然后说明你的提案：简短摘要、为何需要此修改，以及预期影响。",
        c3c: "第 5 步会准确预览提案发布后的样子。检查无误后点击“Submit Proposal”。",
        c4a: "你的提案现已发布并进入协商期 — 类别、作者和审核期限对所有人可见。",
        c4b: "发表评论加入讨论，并跟踪提案的生命周期：协商、就绪、完成。",
    },
};

// Only these language buttons are shown. The remaining translations stay in
// TEXTS above (ready to re-enable) — add an entry here to surface one again.
const LANGS = [
    { id: 'en', label: 'EN' },
    { id: 'ja', label: '日本語' },
    { id: 'es', label: 'ES' },
];

let cues = null;
let cuesLoading = false;

function getLang() {
    const saved = localStorage.getItem('cap_video_lang');
    // Only honour a saved language that is currently shown; otherwise default EN.
    return LANGS.some(l => l.id === saved) ? saved : 'en';
}

function loadCues() {
    if (cues || cuesLoading) return;
    cuesLoading = true;
    fetch('videos/walkthrough_cues.json')
        .then(r => r.json())
        .then(data => { cues = data; })
        .catch(() => { cuesLoading = false; });
}

/** Markup for the video player with captions below the footage. */
export function renderCaptionedVideo(videoUrl) {
    loadCues();
    const lang = getLang();
    return `
    <div class="flex items-center justify-end gap-1 mb-3 flex-wrap">
        <span class="text-sm font-black uppercase tracking-widest text-slate-400 mr-2">Captions</span>
        ${LANGS.map(l => `
        <button data-vidlang="${l.id}" onclick="window.setVideoCaptionLang('${l.id}')"
            class="px-3 py-1.5 rounded-lg text-sm font-black transition-all ${lang === l.id ? 'bg-blue-600 text-white' : 'bg-white/80 border border-slate-200 text-slate-500 hover:text-slate-900'}">
            ${l.label}
        </button>`).join('')}
    </div>
    <div data-vid-player>
        <div class="aspect-video rounded-2xl overflow-hidden border border-slate-100">
            <video src="${videoUrl}" class="w-full h-full" controls
                   controlslist="nofullscreen" disablepictureinpicture
                   ontimeupdate="window.__vidCaptionTick(this)"
                   onseeked="window.__vidCaptionTick(this)"></video>
        </div>
        <div data-vid-overlay class="mt-3 min-h-[88px] flex flex-col items-center justify-start gap-2 text-center" aria-live="polite">
            <div data-vid-badge style="background:#ff5722;color:#fff;border-radius:999px;font-weight:700;
                letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;
                font-family:'Segoe UI',sans-serif;display:none;"></div>
            <div data-vid-caption style="background:rgba(2,40,170,0.95);color:#fff;font-weight:600;line-height:1.4;
                letter-spacing:.01em;box-shadow:0 6px 20px rgba(0,0,0,0.2);
                border:1px solid rgba(255,255,255,0.25);width:100%;text-align:center;
                font-family:'Segoe UI',sans-serif;display:none;"></div>
        </div>
    </div>`;
}

window.setVideoCaptionLang = (lang) => {
    localStorage.setItem('cap_video_lang', lang);
    document.querySelectorAll('[data-vidlang]').forEach(btn => {
        const active = btn.getAttribute('data-vidlang') === lang;
        btn.className = `px-3 py-1.5 rounded-lg text-sm font-black transition-all ${active ? 'bg-blue-600 text-white' : 'bg-white/80 border border-slate-200 text-slate-500 hover:text-slate-900'}`;
    });
    const video = document.querySelector('[data-vid-player] video');
    if (video) window.__vidCaptionTick(video);
};

window.__vidCaptionTick = (video) => {
    if (!cues) { loadCues(); return; }
    const overlay = video.closest('[data-vid-player]')?.querySelector('[data-vid-overlay]');
    if (!overlay) return;
    const t = video.currentTime;
    const lang = getLang();
    const texts = TEXTS[lang];

    // Scale typography with the rendered video width (recorded at 1280px wide)
    const scale = video.clientWidth / 1280;

    const active = { caption: null, badge: null };
    for (const c of cues) {
        if (t >= c.start && t < c.end) active[c.kind] = c;
    }

    const badgeEl = overlay.querySelector('[data-vid-badge]');
    if (active.badge) {
        badgeEl.textContent = texts[active.badge.key] || TEXTS.en[active.badge.key] || '';
        badgeEl.style.fontSize = `${Math.max(11, 13 * scale)}px`;
        badgeEl.style.padding = `${Math.max(4, 6 * scale)}px ${Math.max(12, 20 * scale)}px`;
        badgeEl.style.display = 'block';
    } else {
        badgeEl.style.display = 'none';
    }

    const capEl = overlay.querySelector('[data-vid-caption]');
    if (active.caption) {
        capEl.textContent = texts[active.caption.key] || '';
        capEl.style.fontSize = `${Math.max(13, 18 * scale)}px`;
        capEl.style.padding = `${Math.max(10, 14 * scale)}px ${Math.max(16, 28 * scale)}px`;
        capEl.style.borderRadius = `${Math.max(12, 18 * scale)}px`;
        capEl.style.display = 'block';
    } else {
        capEl.style.display = 'none';
    }
};
