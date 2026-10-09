// lib/config.js
// Huinaology Pomodoro (Public) 전용 설정.
// Pomodoro DB(필수)와 Daily DB(선택, 새 작업 생성 시 오늘 날짜 Daily 페이지를
// Backup 속성으로 자동 연결하는 용도)만 다룬다.
const Config = {
    // 1. 환경 변수 매핑
    ENV: {
        NOTION_TOKEN: process.env.NOTION_TOKEN,
        POMODORO_DB_ID: process.env.POMODORO_DB_ID,
        DAILY_DB_ID: process.env.DAILY_DB_ID,
    },

    // 2. 노션 속성(Property) 스키마 매핑
    SCHEMA: {
        TITLE: { name: 'Title', type: 'title' },
        SCHEDULE: { name: 'Schedule', type: 'date' },
        CHECK: { name: 'Check', type: 'checkbox' },
        PAUSE_TIME: { name: 'PauseTime', type: 'number' },
        PAUSED_AT: { name: 'PausedAt', type: 'date' },
        SORT: { name: 'Sort', type: 'select' },
        NOTE: { name: 'Note', type: 'rich_text' },
        BACKUP: { name: 'Backup', type: 'relation' },
        // 선택 - Pomodoro DB의 Action(관계형) 속성. 이 속성이 없거나 연결된 DB를 읽지 못하면 Action 기능만 조용히 꺼진다.
        ACTION: { name: 'Action', type: 'relation' },
    }
};

module.exports = Config;
