# 🍅 Huinaology Pomodoro Widget

Huinaology 노션 템플릿용 **뽀모도로 타이머 부가기능**입니다. Auto-Backup 위젯에서 뽀모도로 탭만 분리해, 뽀모도로 기능만 따로 쓰고 싶은 분들을 위해 제공합니다.

- Notion 연동 없이 **기본 타이머만** 쓰셔도 되고,
- 본인의 Notion Pomodoro DB를 연결하면 **작업 생성/시작/일시정지/완료가 자동으로 기록**되고, 기록된 시간은 템플릿의 자동 계산에 그대로 반영됩니다.
- Daily DB까지 함께 연결하면, **새 작업을 추가하는 순간 오늘 날짜의 Daily 페이지가 자동으로 연결**됩니다. 자정을 넘겨 끝난 작업은 완료 시점에 걸쳐 있는 모든 날짜가 함께 연결됩니다.
- 템플릿에 포함된 **Action 연결 기능**이 있으면, 새 작업을 추가할 때 **Action 체크박스를 골라 함께 기록**할 수 있고, 작업 목록에도 태그로 표시됩니다. (선택 기능 — 사용할 수 없는 환경이면 이 체크박스만 나타나지 않습니다.)

프로그래밍 지식이 전혀 없어도, 아래 순서를 그대로 따라오시면 5분 안에 설치할 수 있습니다.

## 🚀 준비물 (미리 만들어두면 좋은 것)
1. Notion 계정
2. Github 계정 (https://github.com/) — 없으면 이메일로 무료 가입
3. Vercel 계정 (https://vercel.com/) — **Github 계정으로 바로 가입 가능** (별도 회원가입 불필요)

## 🛠️ 설치 가이드 (No-Code)

### STEP 1. 노션 API 발급받기 (Notion 연동을 쓰실 경우)
그냥 타이머만 쓰실 거라면 이 단계는 건너뛰고 STEP 3으로 가셔도 됩니다.

1. https://app.notion.com/developers/connections 접속 후 로그인
2. **[+ New integration]** 클릭 → 이름(예: `Pomodoro Widget`) 입력 후 워크스페이스 선택 → 제출
3. 발급된 **Internal Integration Secret**(`secret_...`로 시작하는 문자열)을 복사해둡니다. 이게 `NOTION_TOKEN`입니다.

### STEP 2. 연동할 DB 준비하기 (휘나올로지 2027 이후 버전의 기본설정에 맞춰 진행됩니다.)
> ⚠️ 위젯은 템플릿의 **기본 속성 이름·구조 그대로** 동작합니다. 속성 이름이나 DB 구성을 바꾸셨다면 연결되지 않는 기능이 생길 수 있으니, 기본 설정을 유지해주세요.

1. **(자주 빠뜨리는 단계!)** Pomodoro DB, Daily DB 각각의 우측 상단 **[...] → [연결(Connections)] → STEP 1에서 만든 통합(Integration)** 을 추가합니다.
   Action 기능을 쓰신다면 **Action DB에도 같은 방법으로 통합을 연결**해주세요. (이 연결을 빼먹으면 "DB를 찾을 수 없다"는 오류가 나거나, Action 체크박스가 나타나지 않습니다.)
   체크박스를 고르고 새 작업을 추가하면, **같은 이름의 Action 페이지가 새 작업에 자동으로 연결**됩니다. (Action DB에 없는 항목은 연결되지 않고, 작업 추가는 정상적으로 됩니다.)
2. 각 DB 페이지 우측 상단 **[...] → [Copy link]** 로 링크를 복사하면, URL 안에 32자리 DB ID가 들어있습니다. (예: `notion.so/xxxx/1234abcd...?v=...` 에서 `1234abcd...` 부분)

### STEP 3. Vercel로 1초 배포하기
아래 버튼을 누르면 Vercel이 자동으로 **① 이 저장소를 여러분의 Github 계정으로 복사(Fork)하고 → ② 필요한 값을 입력하는 화면을 띄운 뒤 → ③ 자동으로 배포**까지 해줍니다. 코드를 열어보거나 수정할 필요가 전혀 없습니다.

[![Deploy with Vercel](https://vercel.com/button)](https://vercel.com/new/clone?repository-url=https://github.com/huinaology/Huinaology-Pomodoro&env=WIDGET_SECRET,NOTION_TOKEN,POMODORO_DB_ID,DAILY_DB_ID)

버튼을 누르면 순서대로:
1. **Github 로그인/연결**을 요청합니다 → 로그인하면 이 코드가 내 Github 계정에 자동으로 저장소로 만들어집니다.
2. **Create Git Repository** 화면에서 저장소 이름을 정하고(원하는 이름 아무거나) 다음으로 넘어갑니다.
3. **환경 변수 입력 화면**이 뜹니다. 아래 표를 참고해 값을 입력합니다.

    | 환경 변수 | 필수 여부 | 설명 |
    |---|---|---|
    | `WIDGET_SECRET` | 필수 | 위젯 접근 비밀번호. 아무 문자열이나 직접 정해서 입력 (예: `mypomodoro123`) |
    | `NOTION_TOKEN` | 선택 | STEP 1에서 복사한 Integration Secret |
    | `POMODORO_DB_ID` | 선택 | STEP 2의 Pomodoro DB ID |
    | `DAILY_DB_ID` | 선택 | STEP 2의 Daily DB ID (Daily 자동 연결용) |

    `NOTION_TOKEN`/`POMODORO_DB_ID`를 비워두면 **기본 타이머 전용**으로, `DAILY_DB_ID`만 비워두면 **작업 목록은 쓰되 Daily 자동 연결만 꺼진 상태**로 배포됩니다.
4. **Deploy** 버튼을 누르면 1분 이내로 배포가 끝나고, 발급된 주소(`https://내프로젝트이름.vercel.app`)가 나옵니다.

### STEP 4. 노션에 임베드하기
발급받은 주소 뒤에 `?key=STEP 3에서 정한 WIDGET_SECRET값` 을 붙여서 노션 페이지에 **임베드(Embed) 블록**으로 붙여넣으면 끝입니다.

```
https://내프로젝트이름.vercel.app?key=mypomodoro123
```

> 💡 **Notion 연동 없이 타이머만** 쓰실 거라면 `?key=` 대신 주소 끝에 `?timer=1`을 붙여주세요. 안내 문구 없이 타이머만 깔끔하게 보입니다. (예: `https://내프로젝트이름.vercel.app?timer=1`)

> ⚠️ 임베드 화면에 **"vercel.com이(가) 차단되었습니다"** 가 뜬다면, Vercel 프로젝트의 **Settings → Deployment Protection**에서 **Vercel Authentication**을 끄고 저장해주세요. 주소도 Domains에 표시된 `프로젝트이름.vercel.app` 형태를 사용해야 합니다.

## 🛠️ 업데이트 방법
1. 이 저장소(https://github.com/huinaology/Huinaology-Pomodoro)에서 변경된 파일을 열어 전체 코드를 복사합니다.
2. STEP 3에서 만들어진 내 Github 저장소로 이동해 동일한 파일을 열고, 우측 상단 연필 아이콘(Edit this file)으로 기존 코드를 지운 뒤 새 코드를 붙여넣습니다.
3. 페이지 하단 **[Commit changes...]** 로 저장합니다.
4. [Vercel 대시보드](https://vercel.com/dashboard)에서 해당 프로젝트의 **[Deployments] → [...] → [Redeploy]** 를 누르면 끝입니다.

## ❓문제가 생겼을 때
- 위젯에 **"⚠️ Notion 연결 중 오류"** 가 뜬다면, 가장 먼저 **Pomodoro DB · Daily DB · Action DB 각각에 통합(Integration) 연결이 되어 있는지** 확인해주세요. (우측 상단 [...] → 연결(Connections)) 가장 흔하게 빠뜨리는 부분입니다. 오류 문구 아래에 노션이 알려준 원인이 함께 표시됩니다.
- 위젯에 "🔌 Notion 연동이 설정되지 않아..." 안내만 계속 보인다면 `NOTION_TOKEN`/`POMODORO_DB_ID` 값이나 DB의 연결(Connections) 설정을 다시 확인해주세요.
- Action 체크박스가 나타나지 않는다면 ① 템플릿의 기본 속성 구성을 바꾸지 않았는지, ② Action DB에 통합(Integration) 연결을 했는지 확인해주세요.
- 체크박스는 보이는데 Action이 연결되지 않는다면, Action DB의 항목 이름을 템플릿 기본 설정에서 바꾸지 않았는지 확인해주세요. (띄어쓰기나 철자가 다르면 연결되지 않습니다.)
- 새 작업을 추가했는데 Daily 페이지가 안 붙는다면 `DAILY_DB_ID`가 비어있거나, Daily DB의 기본 속성 구성을 바꾸셨거나, 오늘 날짜의 Daily 페이지가 아직 생성되어 있지 않은 경우입니다.
