/**
 * Live caption overlay for the walkthrough video.
 * The video file has no burned-in captions; cues (timings) are loaded from
 * videos/walkthrough_cues.json and the texts below are rendered as HTML
 * overlays styled like the original recording. Language is switchable.
 */

const TEXTS = {
    en: {
        badge1: 'Step 1 of 4 — Connect Wallet',
        badge2: 'Step 2 of 4 — Browse & Select',
        badge3: 'Step 3 of 4 — Submit',
        badge4: 'Step 4 of 4 — Discuss & Track',
        c1a: 'Click “Connect Wallet” and choose your preferred Cardano wallet — Eternl, Lace, Vespr, or any other CIP-30 compatible wallet.',
        c1b: 'Approve the connection request inside your wallet, and your stake address becomes your identity on the portal — no account or password needed.',
        c2a: 'Step 2: once signed in, click “New CAP” to open the Amendment Wizard, choose CAP, pick a category, and give your proposal a title.',
        c2b: 'Click “Browse Constitution” to open the live document, then click and drag across the exact passage you want to change.',
        c2c: 'A popup appears with two options. Choose “Replace” when you’re swapping out existing text for new wording — like we’re doing here.',
        c2d: 'Click “Browse Constitution” again to add a second passage — this time we’ll choose “Add After”, which inserts new text right after a passage without removing the original wording.',
        c2e: 'Both selections are now saved to the proposal. Click “Back to Wizard” to continue.',
        c3a: 'Step 3: write the text for each selection. For the “Replace” passage, this is the exact wording you’re proposing in its place.',
        c3b: 'For the “Add After” passage, this is the new text that gets inserted right after it.',
        c3c: 'Next, explain your reasoning: a short summary and why the change is needed.',
        c3d: 'Review everything one last time — type, category, title, and your selected passages.',
        c3e: 'This preview shows exactly how your proposal will look once it’s published — a good last check before submitting.',
        c3f: 'Click “Submit Proposal” to publish it to the public Registry, where it enters its consultation period.',
        c4a: 'Step 4: your proposal is now live, with its category, author, and review deadline visible to everyone.',
        c4b: 'Add a comment to join the discussion — and track the proposal through consultation, all the way to ratification.',
        c5:  'That’s the full process — connect, browse and select, submit, and discuss. You’re ready to propose your own amendment.',
    },
    ja: {
        badge1: 'ステップ 1 / 4 — ウォレット接続',
        badge2: 'ステップ 2 / 4 — 閲覧と選択',
        badge3: 'ステップ 3 / 4 — 提出',
        badge4: 'ステップ 4 / 4 — 議論と追跡',
        c1a: '「Connect Wallet」をクリックし、お好みのCardanoウォレットを選択してください — Eternl、Lace、Vespr、その他CIP-30対応ウォレットが使えます。',
        c1b: 'ウォレット内で接続リクエストを承認すると、ステークアドレスがポータル上のあなたのIDになります — アカウントもパスワードも不要です。',
        c2a: 'ステップ2：サインイン後、「New CAP」をクリックして修正ウィザードを開き、CAPを選択し、カテゴリを選んで提案にタイトルを付けます。',
        c2b: '「Browse Constitution」をクリックして憲法を開き、変更したい箇所をクリック＆ドラッグで選択します。',
        c2c: 'ポップアップに2つの選択肢が表示されます。既存のテキストを新しい文言に置き換える場合は「Replace」を選びます — ここではそうしています。',
        c2d: 'もう一度「Browse Constitution」をクリックして2つ目の箇所を追加します — 今回は「Add After」を選びます。これは元の文言を削除せずに、直後に新しいテキストを挿入します。',
        c2e: '両方の選択が提案に保存されました。「Back to Wizard」をクリックして続行します。',
        c3a: 'ステップ3：各選択箇所のテキストを書きます。「Replace」の箇所には、置き換えとして提案する正確な文言を入力します。',
        c3b: '「Add After」の箇所には、直後に挿入される新しいテキストを入力します。',
        c3c: '次に、理由を説明します：簡単な要約と、なぜ変更が必要なのかを記述します。',
        c3d: '最後にすべてを確認します — 種類、カテゴリ、タイトル、選択した箇所。',
        c3e: 'このプレビューは、公開後の提案の見た目をそのまま表示します — 提出前の最終チェックに最適です。',
        c3f: '「Submit Proposal」をクリックして公開レジストリに公開すると、協議期間が始まります。',
        c4a: 'ステップ4：提案が公開されました。カテゴリ、作成者、審査期限が誰にでも見えるようになります。',
        c4b: 'コメントを追加して議論に参加しましょう — そして協議から批准まで、提案を追跡できます。',
        c5:  'これで全プロセスの完了です — 接続、閲覧と選択、提出、議論。あなた自身の修正案を提案する準備ができました。',
    },
    es: {
        badge1: 'Paso 1 de 4 — Conectar billetera',
        badge2: 'Paso 2 de 4 — Explorar y seleccionar',
        badge3: 'Paso 3 de 4 — Enviar',
        badge4: 'Paso 4 de 4 — Debatir y seguir',
        c1a: 'Haz clic en «Connect Wallet» y elige tu billetera de Cardano preferida — Eternl, Lace, Vespr o cualquier otra compatible con CIP-30.',
        c1b: 'Aprueba la solicitud de conexión en tu billetera y tu dirección de stake se convierte en tu identidad en el portal — sin cuenta ni contraseña.',
        c2a: 'Paso 2: una vez conectado, haz clic en «New CAP» para abrir el asistente de enmiendas, elige CAP, selecciona una categoría y dale un título a tu propuesta.',
        c2b: 'Haz clic en «Browse Constitution» para abrir el documento y arrastra el cursor sobre el pasaje exacto que quieres cambiar.',
        c2c: 'Aparece una ventana con dos opciones. Elige «Replace» cuando quieras sustituir el texto existente por una nueva redacción — como hacemos aquí.',
        c2d: 'Haz clic en «Browse Constitution» de nuevo para añadir un segundo pasaje — esta vez elegimos «Add After», que inserta texto nuevo justo después de un pasaje sin eliminar la redacción original.',
        c2e: 'Ambas selecciones quedan guardadas en la propuesta. Haz clic en «Back to Wizard» para continuar.',
        c3a: 'Paso 3: escribe el texto de cada selección. Para el pasaje «Replace», esta es la redacción exacta que propones en su lugar.',
        c3b: 'Para el pasaje «Add After», este es el texto nuevo que se insertará justo después.',
        c3c: 'Después, explica tu razonamiento: un breve resumen y por qué es necesario el cambio.',
        c3d: 'Revisa todo una última vez — tipo, categoría, título y los pasajes seleccionados.',
        c3e: 'Esta vista previa muestra exactamente cómo se verá tu propuesta una vez publicada — una buena última revisión antes de enviar.',
        c3f: 'Haz clic en «Submit Proposal» para publicarla en el registro público, donde comienza su período de consulta.',
        c4a: 'Paso 4: tu propuesta ya está publicada, con su categoría, autor y fecha límite de revisión visibles para todos.',
        c4b: 'Añade un comentario para unirte al debate — y sigue la propuesta durante la consulta, hasta su ratificación.',
        c5:  'Ese es el proceso completo — conectar, explorar y seleccionar, enviar y debatir. Ya puedes proponer tu propia enmienda.',
    },
    de: {
        badge1: 'Schritt 1 von 4 — Wallet verbinden',
        badge2: 'Schritt 2 von 4 — Durchsuchen & Auswählen',
        badge3: 'Schritt 3 von 4 — Einreichen',
        badge4: 'Schritt 4 von 4 — Diskutieren & Verfolgen',
        c1a: 'Klicke auf „Connect Wallet“ und wähle deine bevorzugte Cardano-Wallet — Eternl, Lace, Vespr oder jede andere CIP-30-kompatible Wallet.',
        c1b: 'Bestätige die Verbindungsanfrage in deiner Wallet, und deine Stake-Adresse wird zu deiner Identität im Portal — kein Konto, kein Passwort nötig.',
        c2a: 'Schritt 2: Klicke nach der Anmeldung auf „New CAP“, um den Änderungsassistenten zu öffnen, wähle CAP, eine Kategorie und gib deinem Vorschlag einen Titel.',
        c2b: 'Klicke auf „Browse Constitution“, um das Dokument zu öffnen, und ziehe dann mit der Maus über genau die Passage, die du ändern möchtest.',
        c2c: 'Ein Popup mit zwei Optionen erscheint. Wähle „Replace“, wenn du bestehenden Text durch eine neue Formulierung ersetzt — so wie wir hier.',
        c2d: 'Klicke erneut auf „Browse Constitution“, um eine zweite Passage hinzuzufügen — diesmal wählen wir „Add After“, das neuen Text direkt nach einer Passage einfügt, ohne den ursprünglichen Wortlaut zu entfernen.',
        c2e: 'Beide Auswahlen sind nun im Vorschlag gespeichert. Klicke auf „Back to Wizard“, um fortzufahren.',
        c3a: 'Schritt 3: Schreibe den Text für jede Auswahl. Für die „Replace“-Passage ist dies die genaue Formulierung, die du an ihrer Stelle vorschlägst.',
        c3b: 'Für die „Add After“-Passage ist dies der neue Text, der direkt danach eingefügt wird.',
        c3c: 'Erkläre anschließend deine Begründung: eine kurze Zusammenfassung und warum die Änderung nötig ist.',
        c3d: 'Überprüfe alles ein letztes Mal — Typ, Kategorie, Titel und deine ausgewählten Passagen.',
        c3e: 'Diese Vorschau zeigt genau, wie dein Vorschlag nach der Veröffentlichung aussehen wird — eine gute letzte Kontrolle vor dem Einreichen.',
        c3f: 'Klicke auf „Submit Proposal“, um ihn im öffentlichen Register zu veröffentlichen, wo die Konsultationsphase beginnt.',
        c4a: 'Schritt 4: Dein Vorschlag ist jetzt öffentlich, mit Kategorie, Autor und Prüffrist für alle sichtbar.',
        c4b: 'Füge einen Kommentar hinzu, um an der Diskussion teilzunehmen — und verfolge den Vorschlag durch die Konsultation bis zur Ratifizierung.',
        c5:  'Das ist der gesamte Prozess — verbinden, durchsuchen und auswählen, einreichen und diskutieren. Du bist bereit, deine eigene Änderung vorzuschlagen.',
    },
    vi: {
        badge1: 'Bước 1/4 — Kết nối ví',
        badge2: 'Bước 2/4 — Duyệt & chọn',
        badge3: 'Bước 3/4 — Gửi đề xuất',
        badge4: 'Bước 4/4 — Thảo luận & theo dõi',
        c1a: 'Nhấp «Connect Wallet» và chọn ví Cardano bạn ưa thích — Eternl, Lace, Vespr hoặc bất kỳ ví nào tương thích CIP-30.',
        c1b: 'Phê duyệt yêu cầu kết nối trong ví của bạn, và địa chỉ stake sẽ trở thành danh tính của bạn trên cổng — không cần tài khoản hay mật khẩu.',
        c2a: 'Bước 2: sau khi đăng nhập, nhấp «New CAP» để mở trình hướng dẫn sửa đổi, chọn CAP, chọn danh mục và đặt tiêu đề cho đề xuất của bạn.',
        c2b: 'Nhấp «Browse Constitution» để mở tài liệu, sau đó nhấp và kéo qua đúng đoạn văn bạn muốn thay đổi.',
        c2c: 'Một cửa sổ hiện ra với hai lựa chọn. Chọn «Replace» khi bạn muốn thay thế văn bản hiện có bằng nội dung mới — như chúng ta đang làm ở đây.',
        c2d: 'Nhấp «Browse Constitution» một lần nữa để thêm đoạn thứ hai — lần này chúng ta chọn «Add After», chèn văn bản mới ngay sau một đoạn mà không xóa nội dung gốc.',
        c2e: 'Cả hai lựa chọn đã được lưu vào đề xuất. Nhấp «Back to Wizard» để tiếp tục.',
        c3a: 'Bước 3: viết nội dung cho từng lựa chọn. Với đoạn «Replace», đây là nội dung chính xác bạn đề xuất thay thế.',
        c3b: 'Với đoạn «Add After», đây là văn bản mới sẽ được chèn ngay sau đó.',
        c3c: 'Tiếp theo, giải thích lý do: một bản tóm tắt ngắn và tại sao cần thay đổi.',
        c3d: 'Xem lại mọi thứ lần cuối — loại, danh mục, tiêu đề và các đoạn đã chọn.',
        c3e: 'Bản xem trước này hiển thị chính xác đề xuất của bạn sẽ trông như thế nào khi được công bố — một bước kiểm tra cuối tốt trước khi gửi.',
        c3f: 'Nhấp «Submit Proposal» để công bố lên sổ đăng ký công khai, nơi bắt đầu giai đoạn tham vấn.',
        c4a: 'Bước 4: đề xuất của bạn đã được công bố, với danh mục, tác giả và hạn xét duyệt hiển thị cho mọi người.',
        c4b: 'Thêm bình luận để tham gia thảo luận — và theo dõi đề xuất qua giai đoạn tham vấn cho đến khi được phê chuẩn.',
        c5:  'Đó là toàn bộ quy trình — kết nối, duyệt và chọn, gửi và thảo luận. Bạn đã sẵn sàng đề xuất sửa đổi của riêng mình.',
    },
    id: {
        badge1: 'Langkah 1 dari 4 — Hubungkan Dompet',
        badge2: 'Langkah 2 dari 4 — Telusuri & Pilih',
        badge3: 'Langkah 3 dari 4 — Kirim',
        badge4: 'Langkah 4 dari 4 — Diskusi & Pantau',
        c1a: 'Klik «Connect Wallet» dan pilih dompet Cardano favorit Anda — Eternl, Lace, Vespr, atau dompet lain yang kompatibel dengan CIP-30.',
        c1b: 'Setujui permintaan koneksi di dalam dompet Anda, dan alamat stake Anda menjadi identitas Anda di portal — tanpa akun atau kata sandi.',
        c2a: 'Langkah 2: setelah masuk, klik «New CAP» untuk membuka Wizard Amendemen, pilih CAP, pilih kategori, dan beri judul proposal Anda.',
        c2b: 'Klik «Browse Constitution» untuk membuka dokumen, lalu klik dan seret pada bagian teks yang ingin Anda ubah.',
        c2c: 'Sebuah popup muncul dengan dua pilihan. Pilih «Replace» saat Anda ingin mengganti teks yang ada dengan redaksi baru — seperti yang kita lakukan di sini.',
        c2d: 'Klik «Browse Constitution» lagi untuk menambahkan bagian kedua — kali ini kita pilih «Add After», yang menyisipkan teks baru tepat setelah suatu bagian tanpa menghapus redaksi aslinya.',
        c2e: 'Kedua pilihan kini tersimpan dalam proposal. Klik «Back to Wizard» untuk melanjutkan.',
        c3a: 'Langkah 3: tulis teks untuk setiap pilihan. Untuk bagian «Replace», ini adalah redaksi persis yang Anda usulkan sebagai gantinya.',
        c3b: 'Untuk bagian «Add After», ini adalah teks baru yang akan disisipkan tepat setelahnya.',
        c3c: 'Selanjutnya, jelaskan alasan Anda: ringkasan singkat dan mengapa perubahan ini diperlukan.',
        c3d: 'Tinjau semuanya sekali lagi — jenis, kategori, judul, dan bagian yang Anda pilih.',
        c3e: 'Pratinjau ini menunjukkan persis bagaimana proposal Anda akan terlihat setelah dipublikasikan — pemeriksaan terakhir yang baik sebelum mengirim.',
        c3f: 'Klik «Submit Proposal» untuk mempublikasikannya ke Registri publik, di mana masa konsultasinya dimulai.',
        c4a: 'Langkah 4: proposal Anda kini sudah tayang, dengan kategori, penulis, dan tenggat peninjauan yang terlihat oleh semua orang.',
        c4b: 'Tambahkan komentar untuk bergabung dalam diskusi — dan pantau proposal melalui konsultasi hingga ratifikasi.',
        c5:  'Itulah keseluruhan prosesnya — hubungkan, telusuri dan pilih, kirim, dan diskusikan. Anda siap mengusulkan amendemen Anda sendiri.',
    },
    pt: {
        badge1: 'Passo 1 de 4 — Conectar carteira',
        badge2: 'Passo 2 de 4 — Explorar e selecionar',
        badge3: 'Passo 3 de 4 — Enviar',
        badge4: 'Passo 4 de 4 — Discutir e acompanhar',
        c1a: 'Clique em «Connect Wallet» e escolha sua carteira Cardano preferida — Eternl, Lace, Vespr ou qualquer outra compatível com CIP-30.',
        c1b: 'Aprove a solicitação de conexão na sua carteira, e seu endereço de stake se torna sua identidade no portal — sem conta nem senha.',
        c2a: 'Passo 2: depois de entrar, clique em «New CAP» para abrir o assistente de emendas, escolha CAP, selecione uma categoria e dê um título à sua proposta.',
        c2b: 'Clique em «Browse Constitution» para abrir o documento e arraste o cursor sobre o trecho exato que deseja alterar.',
        c2c: 'Um popup aparece com duas opções. Escolha «Replace» quando estiver substituindo o texto existente por uma nova redação — como estamos fazendo aqui.',
        c2d: 'Clique em «Browse Constitution» novamente para adicionar um segundo trecho — desta vez escolhemos «Add After», que insere texto novo logo após um trecho sem remover a redação original.',
        c2e: 'As duas seleções estão salvas na proposta. Clique em «Back to Wizard» para continuar.',
        c3a: 'Passo 3: escreva o texto de cada seleção. Para o trecho «Replace», esta é a redação exata que você propõe no lugar.',
        c3b: 'Para o trecho «Add After», este é o novo texto que será inserido logo depois.',
        c3c: 'Em seguida, explique seu raciocínio: um breve resumo e por que a mudança é necessária.',
        c3d: 'Revise tudo uma última vez — tipo, categoria, título e os trechos selecionados.',
        c3e: 'Esta pré-visualização mostra exatamente como sua proposta ficará depois de publicada — uma boa verificação final antes de enviar.',
        c3f: 'Clique em «Submit Proposal» para publicá-la no Registro público, onde começa seu período de consulta.',
        c4a: 'Passo 4: sua proposta está publicada, com categoria, autor e prazo de revisão visíveis para todos.',
        c4b: 'Adicione um comentário para participar da discussão — e acompanhe a proposta pela consulta até a ratificação.',
        c5:  'Esse é o processo completo — conectar, explorar e selecionar, enviar e discutir. Você está pronto para propor sua própria emenda.',
    },
    fr: {
        badge1: 'Étape 1 sur 4 — Connecter le portefeuille',
        badge2: 'Étape 2 sur 4 — Parcourir et sélectionner',
        badge3: 'Étape 3 sur 4 — Soumettre',
        badge4: 'Étape 4 sur 4 — Discuter et suivre',
        c1a: 'Cliquez sur « Connect Wallet » et choisissez votre portefeuille Cardano préféré — Eternl, Lace, Vespr ou tout autre portefeuille compatible CIP-30.',
        c1b: 'Approuvez la demande de connexion dans votre portefeuille, et votre adresse de stake devient votre identité sur le portail — sans compte ni mot de passe.',
        c2a: 'Étape 2 : une fois connecté, cliquez sur « New CAP » pour ouvrir l’assistant d’amendement, choisissez CAP, sélectionnez une catégorie et donnez un titre à votre proposition.',
        c2b: 'Cliquez sur « Browse Constitution » pour ouvrir le document, puis cliquez et faites glisser sur le passage exact que vous souhaitez modifier.',
        c2c: 'Une fenêtre apparaît avec deux options. Choisissez « Replace » pour remplacer le texte existant par une nouvelle formulation — comme nous le faisons ici.',
        c2d: 'Cliquez à nouveau sur « Browse Constitution » pour ajouter un second passage — cette fois nous choisissons « Add After », qui insère du texte juste après un passage sans supprimer la formulation d’origine.',
        c2e: 'Les deux sélections sont enregistrées dans la proposition. Cliquez sur « Back to Wizard » pour continuer.',
        c3a: 'Étape 3 : rédigez le texte de chaque sélection. Pour le passage « Replace », il s’agit de la formulation exacte que vous proposez à la place.',
        c3b: 'Pour le passage « Add After », il s’agit du nouveau texte qui sera inséré juste après.',
        c3c: 'Ensuite, expliquez votre raisonnement : un bref résumé et pourquoi le changement est nécessaire.',
        c3d: 'Vérifiez tout une dernière fois — type, catégorie, titre et les passages sélectionnés.',
        c3e: 'Cet aperçu montre exactement à quoi ressemblera votre proposition une fois publiée — une bonne dernière vérification avant de soumettre.',
        c3f: 'Cliquez sur « Submit Proposal » pour la publier dans le registre public, où commence sa période de consultation.',
        c4a: 'Étape 4 : votre proposition est maintenant en ligne, avec sa catégorie, son auteur et sa date limite de révision visibles par tous.',
        c4b: 'Ajoutez un commentaire pour rejoindre la discussion — et suivez la proposition pendant la consultation, jusqu’à la ratification.',
        c5:  'Voilà le processus complet — connecter, parcourir et sélectionner, soumettre et discuter. Vous êtes prêt à proposer votre propre amendement.',
    },
    ko: {
        badge1: '1/4 단계 — 지갑 연결',
        badge2: '2/4 단계 — 탐색 및 선택',
        badge3: '3/4 단계 — 제출',
        badge4: '4/4 단계 — 토론 및 추적',
        c1a: '“Connect Wallet”을 클릭하고 선호하는 Cardano 지갑을 선택하세요 — Eternl, Lace, Vespr 또는 다른 CIP-30 호환 지갑 모두 가능합니다.',
        c1b: '지갑에서 연결 요청을 승인하면 스테이크 주소가 포털에서 여러분의 신원이 됩니다 — 계정이나 비밀번호가 필요 없습니다.',
        c2a: '2단계: 로그인 후 “New CAP”을 클릭해 수정안 마법사를 열고, CAP을 선택하고, 카테고리를 고른 뒤 제안서에 제목을 붙입니다.',
        c2b: '“Browse Constitution”을 클릭해 문서를 열고, 변경하려는 구절을 클릭한 채 드래그하여 선택합니다.',
        c2c: '두 가지 옵션이 있는 팝업이 나타납니다. 기존 텍스트를 새 문구로 교체할 때는 “Replace”를 선택하세요 — 여기서 하는 것처럼요.',
        c2d: '“Browse Constitution”을 다시 클릭해 두 번째 구절을 추가합니다 — 이번에는 “Add After”를 선택합니다. 원래 문구를 삭제하지 않고 구절 바로 뒤에 새 텍스트를 삽입합니다.',
        c2e: '두 선택 모두 제안서에 저장되었습니다. “Back to Wizard”를 클릭해 계속 진행하세요.',
        c3a: '3단계: 각 선택에 대한 텍스트를 작성합니다. “Replace” 구절에는 대신 제안하는 정확한 문구를 입력합니다.',
        c3b: '“Add After” 구절에는 바로 뒤에 삽입될 새 텍스트를 입력합니다.',
        c3c: '다음으로 이유를 설명합니다: 짧은 요약과 왜 이 변경이 필요한지 적습니다.',
        c3d: '마지막으로 모든 것을 검토하세요 — 유형, 카테고리, 제목, 선택한 구절들.',
        c3e: '이 미리보기는 제안서가 게시된 후의 모습을 그대로 보여줍니다 — 제출 전 마지막 확인으로 좋습니다.',
        c3f: '“Submit Proposal”을 클릭해 공개 레지스트리에 게시하면 협의 기간이 시작됩니다.',
        c4a: '4단계: 제안서가 게시되었습니다. 카테고리, 작성자, 검토 기한이 모두에게 공개됩니다.',
        c4b: '댓글을 추가해 토론에 참여하세요 — 그리고 협의부터 비준까지 제안서를 추적하세요.',
        c5:  '이것이 전체 과정입니다 — 연결, 탐색 및 선택, 제출, 토론. 이제 여러분만의 수정안을 제안할 준비가 되었습니다.',
    },
    zh: {
        badge1: '第 1 步（共 4 步）— 连接钱包',
        badge2: '第 2 步（共 4 步）— 浏览与选择',
        badge3: '第 3 步（共 4 步）— 提交',
        badge4: '第 4 步（共 4 步）— 讨论与跟踪',
        c1a: '点击“Connect Wallet”，选择您常用的 Cardano 钱包 — Eternl、Lace、Vespr 或任何其他兼容 CIP-30 的钱包。',
        c1b: '在钱包中批准连接请求后，您的质押地址就成为您在门户上的身份 — 无需账户或密码。',
        c2a: '第 2 步：登录后，点击“New CAP”打开修正案向导，选择 CAP，挑选类别，并为您的提案取一个标题。',
        c2b: '点击“Browse Constitution”打开宪法文档，然后按住鼠标拖选您想要修改的确切段落。',
        c2c: '弹窗中会出现两个选项。当您要用新措辞替换现有文本时，选择“Replace” — 就像我们这里所做的。',
        c2d: '再次点击“Browse Constitution”添加第二个段落 — 这次我们选择“Add After”，它会在段落之后插入新文本，而不删除原有措辞。',
        c2e: '两个选择都已保存到提案中。点击“Back to Wizard”继续。',
        c3a: '第 3 步：为每个选择撰写文本。对于“Replace”段落，这是您提议用来替换的确切措辞。',
        c3b: '对于“Add After”段落，这是将插入其后的新文本。',
        c3c: '接下来，说明您的理由：简短的摘要以及为什么需要这项修改。',
        c3d: '最后再检查一遍 — 类型、类别、标题和您选择的段落。',
        c3e: '此预览准确展示提案发布后的样子 — 是提交前很好的最后检查。',
        c3f: '点击“Submit Proposal”将其发布到公共登记处，进入咨询期。',
        c4a: '第 4 步：您的提案现已发布，类别、作者和审核截止日期对所有人可见。',
        c4b: '添加评论加入讨论 — 并跟踪提案从咨询到最终批准的全过程。',
        c5:  '这就是完整流程 — 连接、浏览与选择、提交、讨论。您已准备好提出自己的修正案。',
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

/** Markup for the video player with overlay + language toggle. */
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
    <div class="aspect-video rounded-2xl overflow-hidden border border-slate-100 relative">
        <video src="${videoUrl}" class="w-full h-full" controls
               controlslist="nofullscreen" disablepictureinpicture
               ontimeupdate="window.__vidCaptionTick(this)"
               onseeked="window.__vidCaptionTick(this)"></video>
        <div data-vid-overlay style="position:absolute;inset:0;pointer-events:none;overflow:hidden;">
            <div data-vid-badge style="position:absolute;top:3.3%;left:50%;transform:translateX(-50%);
                background:#ff5722;color:#fff;border-radius:999px;font-weight:700;
                letter-spacing:.08em;text-transform:uppercase;white-space:nowrap;
                font-family:'Segoe UI',sans-serif;display:none;"></div>
            <div data-vid-caption style="position:absolute;top:10.5%;left:50%;transform:translateX(-50%);
                background:rgba(2,40,170,0.95);color:#fff;font-weight:600;line-height:1.4;
                letter-spacing:.01em;box-shadow:0 8px 30px rgba(0,0,0,0.35);
                border:1px solid rgba(255,255,255,0.25);max-width:74%;text-align:center;
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
    const video = document.querySelector('[data-vid-overlay]')?.parentElement?.querySelector('video');
    if (video) window.__vidCaptionTick(video);
};

window.__vidCaptionTick = (video) => {
    if (!cues) { loadCues(); return; }
    const overlay = video.parentElement.querySelector('[data-vid-overlay]');
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
        badgeEl.textContent = texts[active.badge.key] || '';
        badgeEl.style.fontSize = `${13 * scale}px`;
        badgeEl.style.padding = `${6 * scale}px ${20 * scale}px`;
        badgeEl.style.display = 'block';
    } else {
        badgeEl.style.display = 'none';
    }

    const capEl = overlay.querySelector('[data-vid-caption]');
    if (active.caption) {
        capEl.textContent = texts[active.caption.key] || '';
        capEl.style.fontSize = `${20 * scale}px`;
        capEl.style.padding = `${16 * scale}px ${36 * scale}px`;
        capEl.style.borderRadius = `${24 * scale}px`;
        capEl.style.display = 'block';
    } else {
        capEl.style.display = 'none';
    }
};
