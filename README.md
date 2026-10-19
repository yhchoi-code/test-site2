# GitHub Pages + Firebase 직원 로그인 시범 실습

기존 `index.html`, `styles.css`, `config.js` 파일은 건드리지 않고, 아래 세 파일을 같은 폴더(배포 폴더)에 올립니다.

- `auth-test.html`: 테스트 페이지 (로그인 / 회원가입 / 승인 현황 / 관리자 목록)
- `auth-test.js`: 로그인, 이메일 인증, Firestore 프로필, 승인 처리 기능
- `firebase-config.js`: 프로젝트별 공개 Firebase 웹앱 설정 + 이메일 도메인

`firestore.rules` 파일은 GitHub Pages에서 사용되는 파일이 아니라, **Firebase 콘솔 > Firestore Database > 규칙(Rules)**에 붙여넣어 게시할 코드입니다. GitHub에 올리지 않아도 됩니다.

## 1. Firebase 프로젝트 만들기
1. https://console.firebase.google.com 에 로그인 > 프로젝트 추가.
2. 요금제를 **Spark(무료)**로 유지합니다. 이 실습에서 결제수단은 필요하지 않습니다.
3. 프로젝트 개요 옆의 웹 앱 `</>` 등록 > 앱 이름 입력 > 웹 앱 생성.
4. 제공되는 `firebaseConfig` 객체 값을 `firebase-config.js`에 복사합니다. (서비스 계정 비공개 키는 절대 복사하지 마세요.)

## 2. Authentication
1. 빌드/제품 카테고리의 Authentication > 시작하기 > Sign-in method.
2. **이메일/비밀번호(Email/Password)** 활성화 후 저장합니다.
3. Settings > Authorized domains가 보인다면 `내아이디.github.io`를 등록합니다. (`https://` 또는 `/저장소명`은 입력하지 않음.)
4. 이메일 인증 링크가 제대로 도착하는지 확인합니다.

## 3. Firestore
1. Firestore Database > 데이터베이스 만들기 > Standard 에디션, `(default)` 데이터베이스.
2. 서버 위치를 선택한 후 **프로덕션 모드**로 시작합니다.
3. Rules 탭에 `firestore.rules` 내용을 모두 붙여넣고 게시(Publish)합니다.
4. `firebase-config.js`의 `ALLOWED_DOMAIN`과 `firestore.rules`의 `example[.]org`를 실제 허용할 도메인으로 **둘 다 변경**합니다.
   - 예시: `foundation.or.kr` / `foundation[.]or[.]kr`.
   - 실제 회사 도메인이 없다면 테스트용으로 본인 소유 이메일 주소의 도메인을 임시 지정할 수 있습니다. 도메인만으로 직원 소속을 확인하는 것은 아니므로 실제 운영 전 추가 점검이 필요합니다.

## 4. GitHub Pages 테스트
1. `auth-test.html`, `auth-test.js`, `firebase-config.js`를 기존 GitHub Pages 게시 폴더에 추가해 커밋합니다.
2. `https://내아이디.github.io/test-site/auth-test.html`처럼 **실제 저장소 주소**로 접속합니다.
3. 허용 도메인 이메일로 회원가입하고 인증 메일 링크를 누릅니다.
4. 테스트 페이지로 돌아와 `[이메일 인증 완료 확인]`을 클릭하면 관리자 승인 대기 상태가 표시됩니다.

## 5. 최초 관리자 지정 (한 번만 수행)
1. 관리자 본인 이메일로 위와 똑같이 회원가입 + 이메일 인증을 완료합니다.
2. Firebase Console > Authentication > Users에서 본인 계정의 **UID**를 복사합니다.
3. Firestore Database > Data > `users` 컬렉션 > 해당 UID 문서를 엽니다.
4. 다음 필드만 **Firebase 콘솔에서 직접 수정**합니다.
   - `role`: `member` → `admin`
   - `status`: `pending` → `approved`
5. 테스트 페이지를 새로고침 또는 다시 로그인합니다. 관리자 승인 UI가 표시됩니다.
6. 다른 계정으로 회원가입하여 관리자가 승인/거절/정지 처리할 수 있는지 시험합니다.

## 주의
- GitHub Pages에 게시한 HTML/CSS/JS **전체는 공개 접근 가능**합니다. 이 예제의 승인 화면은 동작 흐름을 시연하는 UI일 뿐입니다.
- Firestore의 `users` 계정 프로필은 보안 규칙으로 보호합니다. **업무 자료의 진짜 비공개가 필요해지면**, 해당 자료도 별도로 인증된 사용자에게만 읽기 허용되는 곳으로 옮겨야 합니다.
- Firebase 웹 `apiKey` / 프로젝트 설정값은 비밀 키가 아니며 프런트엔드에 들어갈 수 있습니다. **서비스 계정 JSON 개인키나 관리자 SDK 자격증명은 절대 GitHub에 올리지 마세요.**
- 이 예시는 소규모 시범용입니다. 실제 운영 전 관리자 승인 규칙 테스트, 이메일 변경 정책, 탈퇴/삭제 정책, 재단 개인정보 처리 기준을 검토하세요.
- 이메일당 한 개 계정은 Firebase 이메일/비밀번호 인증의 중복 계정 관리에 기반합니다. 동일 인물의 여러 이메일 가입을 제한하려면 별도 정책이 필요합니다.
- 가입 제한을 UI와 Firestore 규칙에서 적용하더라도 Firebase Authentication 서비스에는 허용하지 않은 도메인의 계정 생성 요청 자체가 발생할 수 있습니다. 이 예제는 승인/Firestore 데이터 접근을 차단하는 구성이지 Auth 사용자 생성 API를 도메인 차원에서 완전히 차단하는 시스템은 아닙니다.

참고: https://firebase.google.com/docs/web/alt-setup, https://firebase.google.com/docs/auth/web/password-auth, https://firebase.google.com/docs/firestore/security/get-started
