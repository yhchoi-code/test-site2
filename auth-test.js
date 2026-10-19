// 브라우저에서 npm 없이 사용하도록 공식 Firebase CDN 모듈을 사용합니다.
import { initializeApp } from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-app.js';
import {
  getAuth, createUserWithEmailAndPassword, signInWithEmailAndPassword,
  sendEmailVerification, onAuthStateChanged, signOut, reload, getIdToken
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-auth.js';
import {
  getFirestore, doc, setDoc, onSnapshot, collection, updateDoc, serverTimestamp
} from 'https://www.gstatic.com/firebasejs/12.19.0/firebase-firestore.js';
import { firebaseConfig, ALLOWED_DOMAIN } from './firebase-config.js';

const $ = (id) => document.getElementById(id);
const show = (id, yes) => { $(id).hidden = !yes; };
const message = (text) => { $('message').textContent = text; };
const isAllowedEmail = (email) => {
  const parts = email.trim().toLowerCase().split('@');
  return parts.length === 2 && parts[0].length > 0 && parts[1] === ALLOWED_DOMAIN.toLowerCase();
};
const errorText = (e) => ({
  'auth/email-already-in-use': '이미 가입된 이메일입니다. 로그인하거나 비밀번호를 재설정하세요.',
  'auth/invalid-email': '이메일 주소 형식을 확인해 주세요.',
  'auth/weak-password': '더 안전한 비밀번호를 사용해 주세요.',
  'auth/invalid-credential': '이메일 또는 비밀번호를 확인해 주세요.',
  'auth/too-many-requests': '요청이 많아 일시적으로 제한되었습니다. 나중에 다시 시도하세요.',
  'permission-denied': '데이터베이스 접근이 거절되었습니다. Firestore 보안 규칙과 이메일 도메인을 확인하세요.'
})[e.code] || `오류: ${e.code || e.message}`;

$('domain-label').textContent = `@${ALLOWED_DOMAIN}`;
if (firebaseConfig.apiKey.startsWith('PASTE_') || firebaseConfig.projectId === 'YOUR_PROJECT_ID') {
  message('먼저 firebase-config.js의 Firebase 설정값과 ALLOWED_DOMAIN을 수정하세요.');
  throw new Error('Firebase 설정 미완료');
}
const app = initializeApp(firebaseConfig);
const auth = getAuth(app);
auth.languageCode = 'ko';
const db = getFirestore(app);
let currentProfile = null;
let stopProfile = null;
let stopUsers = null;

function unsubscribeAll() {
  if (stopProfile) { stopProfile(); stopProfile = null; }
  if (stopUsers) { stopUsers(); stopUsers = null; }
}
function render() {
  const user = auth.currentUser;
  show('guest', !user);
  show('member', !!user);
  show('approved', false);
  show('admin', false);
  if (!user) return;
  $('current-email').textContent = user.email || '';
  const status = $('account-status');
  if (!user.emailVerified) {
    status.textContent = '이메일 인증 대기: 받은 편지함의 인증 링크를 누른 뒤, 아래 [이메일 인증 완료 확인]을 누르세요.';
    message('이메일 인증이 필요합니다.');
  } else if (!currentProfile) {
    status.textContent = '가입 신청 정보를 찾지 못했습니다. 가입 처리 중이라면 잠시 후 다시 확인하세요.';
    message('계정 프로필 확인 중…');
  } else if (currentProfile.status === 'pending') {
    status.textContent = '관리자 승인 대기 중입니다.';
    message('이메일 인증 완료 · 관리자 승인 대기');
  } else if (currentProfile.status === 'approved') {
    status.textContent = '승인 완료! 테스트 영역을 사용할 수 있습니다.';
    show('approved', true);
    const admin = currentProfile.role === 'admin';
    show('admin', admin);
    if (admin && !stopUsers) startAdminList();
    if (!admin && stopUsers) { stopUsers(); stopUsers = null; }
    message(admin ? '관리자 로그인 성공' : '승인된 직원 로그인 성공');
  } else {
    status.textContent = currentProfile.status === 'rejected' ? '가입 신청이 거절되었습니다.' : '계정 이용이 정지되었습니다.';
    message('계정을 사용할 수 없습니다.');
  }
  if (currentProfile?.status !== 'approved' && stopUsers) { stopUsers(); stopUsers = null; }
}

function startAdminList() {
  stopUsers = onSnapshot(collection(db, 'users'), (snap) => {
    const container = $('users-list');
    container.replaceChildren();
    const others = snap.docs.filter((d) => d.id !== auth.currentUser?.uid);
    if (!others.length) { container.textContent = '아직 다른 가입자가 없습니다.'; return; }
    for (const item of others) {
      const data = item.data();
      const row = document.createElement('div');
      row.className = 'user';
      const info = document.createElement('div');
      const name = document.createElement('strong');
      name.textContent = data.name || '이름 없음';
      const line = document.createElement('div');
      line.className = 'muted';
      line.textContent = `${data.email || ''} · ${data.status || '상태 없음'}`;
      info.append(name, line);
      const actions = document.createElement('div');
      actions.className = 'row';
      for (const [label, nextStatus, css] of [
        ['승인', 'approved', ''], ['거절', 'rejected', 'secondary'], ['정지', 'suspended', 'warn']
      ]) {
        const btn = document.createElement('button');
        btn.textContent = label;
        btn.className = css;
        btn.disabled = data.status === nextStatus;
        btn.addEventListener('click', async () => {
          if (!confirm(`${data.email} 계정을 '${label}' 처리할까요?`)) return;
          try { await updateDoc(doc(db, 'users', item.id), { status: nextStatus }); }
          catch (e) { message(errorText(e)); }
        });
        actions.append(btn);
      }
      row.append(info, actions);
      container.append(row);
    }
  }, (e) => { $('users-list').textContent = `목록 조회 실패: ${errorText(e)}`; });
}

onAuthStateChanged(auth, (user) => {
  unsubscribeAll();
  currentProfile = null;
  if (!user) { render(); message('로그인하거나 회원가입을 신청하세요.'); return; }
  render();
  stopProfile = onSnapshot(doc(db, 'users', user.uid), (snap) => {
    currentProfile = snap.exists() ? snap.data() : null;
    render();
  }, (e) => message(`프로필 조회 실패: ${errorText(e)}`));
});

$('signup-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  const name = $('signup-name').value.trim();
  const email = $('signup-email').value.trim().toLowerCase();
  const password = $('signup-password').value;
  if (!isAllowedEmail(email)) { message(`@${ALLOWED_DOMAIN} 이메일만 가입할 수 있습니다.`); return; }
  try {
    const result = await createUserWithEmailAndPassword(auth, email, password);
    await setDoc(doc(db, 'users', result.user.uid), {
      name, email, role: 'member', status: 'pending', createdAt: serverTimestamp()
    });
    await sendEmailVerification(result.user);
    message('가입 신청이 접수되었습니다. 이메일 인증 링크를 확인해 주세요.');
  } catch (e) { message(errorText(e)); }
});
$('login-form').addEventListener('submit', async (event) => {
  event.preventDefault();
  try {
    await signInWithEmailAndPassword(auth, $('login-email').value.trim(), $('login-password').value);
    message('로그인 상태 확인 중…');
  } catch (e) { message(errorText(e)); }
});
$('refresh-btn').addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return;
  try {
    await reload(user);
    await getIdToken(user, true); // Firestore 규칙의 email_verified 토큰도 갱신
    render();
  } catch (e) { message(errorText(e)); }
});
$('resend-btn').addEventListener('click', async () => {
  const user = auth.currentUser;
  if (!user) return;
  try { await sendEmailVerification(user); message('인증 이메일을 다시 보냈습니다.'); }
  catch (e) { message(errorText(e)); }
});
$('logout-btn').addEventListener('click', () => signOut(auth).catch((e) => message(errorText(e))));
