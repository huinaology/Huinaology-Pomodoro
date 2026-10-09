// api/pomodoro.js
const { Client } = require('@notionhq/client');
const Config = require('../lib/config');

const ICON_START = "https://api.iconify.design/lucide/arrow-right.svg?color=black";
const ICON_FINISH = "https://api.iconify.design/lucide/check.svg?color=%232D8B7E";

async function findDailyPageId(notion, dailyDbId, dateStr) {
    if (!dailyDbId) return null;
    try {
        const res = await notion.databases.query({
            database_id: dailyDbId,
            filter: { property: Config.SCHEMA.SCHEDULE.name, date: { equals: dateStr } },
            page_size: 1
        });
        return res.results[0]?.id || null;
    } catch (e) { return null; }
}

// Pomodoro DB의 실제 속성 이름을 대소문자 구분 없이 찾는다. (노션 API는 속성 이름의 대소문자까지 정확히 요구한다.)
// 필수 속성이 없으면 어떤 속성인지 알려주는 오류를 던지고, 선택 속성(Sort/Note/Backup)은 없으면 null로 두어 그 기능만 건너뛴다.
function resolvePomodoroProps(pomoDb) {
    const props = pomoDb.properties || {};
    const names = Object.keys(props);
    const find = (key) => names.find(k => k.toLowerCase() === Config.SCHEMA[key].name.toLowerCase()) || null;
    const need = (key) => {
        const found = find(key);
        if (!found) throw new Error(`Pomodoro DB에서 '${Config.SCHEMA[key].name}' 속성을 찾을 수 없습니다. 템플릿의 기본 속성 구성을 바꾸지 않았는지 확인해주세요.`);
        return found;
    };
    return {
        titleProp: names.find(k => props[k].type === 'title') || need('TITLE'),
        schedProp: need('SCHEDULE'),
        checkProp: need('CHECK'),
        pauseTimeProp: need('PAUSE_TIME'),
        pausedAtProp: need('PAUSED_AT'),
        sortProp: find('SORT'),
        noteProp: find('NOTE'),
        backupProp: find('BACKUP'),
    };
}

// Pomodoro DB의 Action(관계형) 속성이 가리키는 DB를 읽어 "선택할 수 있는 Action 목록"을 만든다.
// 속성이 없거나, 연결된 DB를 읽을 수 없으면(통합 연결 누락 등) null을 돌려주고 Action 기능은 조용히 꺼진다.
async function getActionCatalog(notion, pomoDb) {
    try {
        const wanted = Config.SCHEMA.ACTION.name.toLowerCase();
        const propName = Object.keys(pomoDb.properties || {}).find(k => k.toLowerCase() === wanted);
        if (!propName) return null;

        const relatedDbId = pomoDb.properties[propName]?.relation?.database_id;
        if (!relatedDbId) return { propName, pages: [] };

        const relatedDb = await notion.databases.retrieve({ database_id: relatedDbId });
        const titlePropName = Object.keys(relatedDb.properties || {}).find(k => relatedDb.properties[k].type === 'title');
        if (!titlePropName) return { propName, pages: [] };

        const queryResult = await notion.databases.query({ database_id: relatedDbId, page_size: 100 });
        const pages = queryResult.results.map(p => {
            const t = p.properties[titlePropName]?.title;
            return { id: p.id, name: t && t.length > 0 ? t.map(x => x.plain_text).join('') : '' };
        }).filter(pg => pg.name);
        return { propName, pages };
    } catch (e) {
        return null;
    }
}

const toKSTISOString = (dateObj) => {
    const kstObj = new Date(dateObj.getTime() + 9 * 60 * 60 * 1000);
    return kstObj.toISOString().substring(0, 19) + '+09:00';
};

const getKstDateStr = (kstIsoString) => {
    return kstIsoString.substring(0, 10);
};

function getDatesBetween(startDateStr, endDateStr) {
    const dates = [];
    let curr = new Date(startDateStr);
    const end = new Date(endDateStr);
    while (curr <= end) {
        dates.push(curr.toISOString().split('T')[0]);
        curr.setDate(curr.getDate() + 1);
    }
    return dates;
}

module.exports = async (req, res) => {
    const { key, mode, title, note, pageId, action } = req.query;
    if (!process.env.WIDGET_SECRET || key !== process.env.WIDGET_SECRET) {
        return res.status(401).json({ success: false, error: "⛔ 접근 권한이 없습니다." });
    }

    const { NOTION_TOKEN, POMODORO_DB_ID, DAILY_DB_ID } = Config.ENV;
    if (!NOTION_TOKEN || !POMODORO_DB_ID) {
        // 노션 연동이 설정되지 않음 - 프론트엔드는 이 응답을 받으면 로컬 전용(기본) 타이머로 동작한다.
        return res.status(200).json({ success: false, notConfigured: true, error: "NOTION_TOKEN 또는 POMODORO_DB_ID가 설정되지 않았습니다." });
    }

    const notion = new Client({ auth: NOTION_TOKEN, timeoutMs: 55000, notionVersion: '2022-06-28' });

    try {
        const pomoDb = await notion.databases.retrieve({ database_id: POMODORO_DB_ID });
        const { schedProp, checkProp, titleProp, pauseTimeProp, pausedAtProp, sortProp, noteProp, backupProp } = resolvePomodoroProps(pomoDb);

        if (mode === 'list') {
            const nowKst = toKSTISOString(new Date());
            const todayStr = getKstDateStr(nowKst);

            const queryResult = await notion.databases.query({
                database_id: POMODORO_DB_ID,
                filter: {
                    or: [
                        { property: checkProp, checkbox: { equals: false } },
                        {
                            and: [
                                { property: schedProp, date: { on_or_after: todayStr } },
                                { property: schedProp, date: { on_or_before: todayStr } }
                            ]
                        }
                    ]
                },
                sorts: [{ property: schedProp, direction: "descending" }],
                page_size: 100
            });

            const activeTasks = [];
            const todoTasks = [];
            const finishedTasks = [];

            // Action 목록(선택 기능). 속성이 없거나 Action DB를 읽을 수 없으면 actionEnabled가 false라 화면에서 Action 체크박스가 숨겨진다.
            const actionCatalog = await getActionCatalog(notion, pomoDb);
            const actionIdToName = new Map((actionCatalog?.pages || []).map(pg => [pg.id, pg.name]));

            queryResult.results.forEach(p => {
                const titleArr = p.properties[titleProp]?.title;
                const text = titleArr && titleArr.length > 0 ? titleArr.map(t => t.plain_text).join('') : "(이름 없음)";
                const isChecked = p.properties[checkProp]?.checkbox === true;
                const startIso = p.properties[schedProp]?.date?.start;
                const endIso = p.properties[schedProp]?.date?.end;
                const pauseTime = p.properties[pauseTimeProp]?.number || 0;
                const sort = sortProp ? (p.properties[sortProp]?.select?.name || null) : null;

                let actionNames = [];
                if (actionCatalog?.propName) {
                    const relIds = p.properties[actionCatalog.propName]?.relation?.map(r => r.id) || [];
                    actionNames = relIds.map(id => actionIdToName.get(id)).filter(Boolean);
                }

                if (!startIso) return;

                const taskDate = getKstDateStr(startIso);
                const taskEndDate = endIso ? getKstDateStr(endIso) : taskDate;
                const touchesToday = taskDate <= todayStr && taskEndDate >= todayStr;
                if (!touchesToday && isChecked) return;

                const taskObj = {
                    id: p.id,
                    title: text,
                    sort: sort,
                    start: startIso,
                    end: endIso,
                    pausedAt: p.properties[pausedAtProp]?.date?.start || null,
                    pauseTime: pauseTime,
                    action: actionNames,
                    isActive: false
                };

                if (isChecked) {
                    finishedTasks.push(taskObj);
                } else if (!endIso) {
                    let isStarted = false;
                    if (p.icon && p.icon.type === 'external' && p.icon.external.url && p.icon.external.url.includes('arrow-right')) {
                        isStarted = true;
                    }
                    if (pauseTime > 0) {
                        isStarted = true;
                    }
                    if (p.properties[pausedAtProp] && p.properties[pausedAtProp].date && p.properties[pausedAtProp].date.start) {
                        isStarted = true;
                    }

                    if (isStarted) {
                        taskObj.isActive = true;
                        activeTasks.push(taskObj);
                    } else {
                        todoTasks.push(taskObj);
                    }
                } else {
                    todoTasks.push(taskObj);
                }
            });

            const actionEnabled = !!actionCatalog?.propName;
            return res.status(200).json({ success: true, activeTasks, todoTasks, finishedTasks, actionEnabled });
        }

        if (mode === 'start') {
            if (!title) return res.status(400).json({ success: false, error: "title이 필요합니다." });

            const nowKst = toKSTISOString(new Date());
            const todayStr = getKstDateStr(nowKst);

            try {
                const properties = {
                    [titleProp]: { title: [{ text: { content: String(title) } }] },
                    [schedProp]: { date: { start: nowKst } },
                    [checkProp]: { checkbox: false },
                    [pauseTimeProp]: { number: 0 }
                };

                // Sort 속성이 있는 DB에서만 "Pomodoro" 분류를 지정한다.
                if (sortProp) properties[sortProp] = { select: { name: "Pomodoro" } };

                if (noteProp && note && typeof note === 'string' && note.trim().length > 0) {
                    properties[noteProp] = { rich_text: [{ text: { content: note.trim() } }] };
                }

                // Daily DB가 연결되어 있으면 오늘 날짜의 Daily 페이지를 Backup 속성으로 자동 연결한다.
                if (backupProp) {
                    const todayDailyPageId = await findDailyPageId(notion, DAILY_DB_ID, todayStr);
                    if (todayDailyPageId) {
                        properties[backupProp] = { relation: [{ id: todayDailyPageId }] };
                    }
                }

                // 선택한 Action 이름들(action=이름 이 여러 번 올 수 있음)을 Action 속성(관계형)으로 연결한다. Action 속성이 없으면 건너뛴다.
                const labels = [].concat(action || []).map(s => String(s).trim()).filter(Boolean);
                if (labels.length > 0) {
                    const actionCatalog = await getActionCatalog(notion, pomoDb);
                    if (actionCatalog?.propName) {
                        const actionIds = labels
                            .map(label => actionCatalog.pages.find(pg => pg.name === label)?.id)
                            .filter(Boolean);
                        if (actionIds.length > 0) {
                            properties[actionCatalog.propName] = { relation: actionIds.map(id => ({ id })) };
                        }
                    }
                }

                await notion.pages.create({
                    parent: { database_id: POMODORO_DB_ID },
                    properties
                });
                return res.status(200).json({ success: true });
            } catch (createErr) {
                console.error("Notion Create Error:", createErr);
                return res.status(500).json({ success: false, error: createErr.message });
            }
        }

        if (mode === 'start_existing') {
            if (!pageId) return res.status(400).json({ success: false, error: "pageId가 필요합니다." });
            const nowKst = toKSTISOString(new Date());

            try {
                await notion.pages.update({
                    page_id: pageId,
                    properties: {
                        [schedProp]: { date: { start: nowKst } },
                        [checkProp]: { checkbox: false },
                        [pauseTimeProp]: { number: 0 }
                    },
                    icon: { type: "external", external: { url: ICON_START } }
                });
                return res.status(200).json({ success: true });
            } catch (e) {
                return res.status(500).json({ success: false, error: e.message });
            }
        }

        if (mode === 'hold') {
            if (!pageId) return res.status(400).json({ success: false, error: "pageId가 필요합니다." });
            const nowKst = toKSTISOString(new Date());

            await notion.pages.update({
                page_id: pageId,
                properties: {
                    [pausedAtProp]: { date: { start: nowKst } }
                }
            });
            return res.status(200).json({ success: true });
        }

        if (mode === 'resume') {
            if (!pageId) return res.status(400).json({ success: false, error: "pageId가 필요합니다." });

            try {
                const page = await notion.pages.retrieve({ page_id: pageId });
                const pausedAtIso = page.properties[pausedAtProp]?.date?.start;
                let pauseTime = Number(page.properties[pauseTimeProp]?.number) || 0;

                if (pausedAtIso) {
                    const pausedMs = new Date().getTime() - new Date(pausedAtIso).getTime();
                    if (!isNaN(pausedMs)) {
                        pauseTime += Math.floor(pausedMs / 1000);
                    }
                }
                if (isNaN(pauseTime) || pauseTime < 0) pauseTime = 0;

                await notion.pages.update({
                    page_id: pageId,
                    properties: {
                        [pausedAtProp]: { date: null },
                        [pauseTimeProp]: { number: pauseTime }
                    }
                });
                return res.status(200).json({ success: true });
            } catch (e) {
                return res.status(500).json({ success: false, error: e.message });
            }
        }

        if (mode === 'finish') {
            if (!pageId) return res.status(400).json({ success: false, error: "pageId가 필요합니다." });

            const page = await notion.pages.retrieve({ page_id: pageId });
            const startIso = page.properties[schedProp]?.date?.start;
            if (!startIso) return res.status(400).json({ success: false, error: "시작 시간이 없는 페이지입니다." });

            const pausedAtIso = page.properties[pausedAtProp]?.date?.start;
            let pauseTime = Number(page.properties[pauseTimeProp]?.number) || 0;

            const now = new Date();
            if (pausedAtIso) {
                const pausedMs = now.getTime() - new Date(pausedAtIso).getTime();
                if (!isNaN(pausedMs)) {
                    pauseTime += Math.floor(pausedMs / 1000);
                }
            }
            if (isNaN(pauseTime) || pauseTime < 0) pauseTime = 0;

            const nowKst = toKSTISOString(now);
            const startPhysicalDate = getKstDateStr(startIso);
            const endPhysicalDate = getKstDateStr(nowKst);

            const propsToUpdate = {
                [schedProp]: { date: { start: startIso, end: nowKst } },
                [checkProp]: { checkbox: true },
                [pausedAtProp]: { date: null },
                [pauseTimeProp]: { number: pauseTime }
            };

            // 자정을 넘겨 여러 날에 걸친 작업이면, 걸쳐 있는 모든 날짜의 Daily 페이지를 Backup에 추가로 연결한다.
            if (DAILY_DB_ID && backupProp && startPhysicalDate !== endPhysicalDate) {
                const currentBackups = page.properties[backupProp]?.relation?.map(r => r.id) || [];
                const backupSet = new Set(currentBackups);

                const dates = getDatesBetween(startPhysicalDate, endPhysicalDate);
                for (const d of dates) {
                    const dailyId = await findDailyPageId(notion, DAILY_DB_ID, d);
                    if (dailyId) backupSet.add(dailyId);
                }
                propsToUpdate[backupProp] = { relation: Array.from(backupSet).map(id => ({ id })) };
            }

            await notion.pages.update({
                page_id: pageId,
                properties: propsToUpdate,
                icon: { type: "external", external: { url: ICON_FINISH } }
            });

            return res.status(200).json({ success: true });
        }

        return res.status(400).json({ success: false, error: "유효하지 않은 mode입니다." });
    } catch (err) {
        return res.status(500).json({ success: false, error: err.message });
    }
};
