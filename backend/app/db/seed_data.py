from datetime import date, timedelta
from backend.app.db.session import SessionLocal, init_db
from backend.app.db.models import Soldier, Task, CadenceRoutine, ReflectionLog

def seed_database():
    init_db()
    db = SessionLocal()

    # Avoid duplicate seeding
    if db.query(Soldier).first():
        print("Database already contains data, skipping seed.")
        db.close()
        return

    today = date.today()

    # 30 Soldiers across 5 teams
    soldiers_data = [
        # --- צוות 1: אלגוריתמיקה וסג"ח (6 אנשים) ---
        {
            "full_name": "איתי לוי",
            "team": "צוות 1",
            "role": "רש\"צ אלגוריתמים",
            "population": "קבע",
            "rank": "סרן",
            "city": "מודיעין",
            "education": "תואר ראשון במדמ\"ח (ת\"א), תואר שני בתהליך",
            "welfare": "ללא",
            "release_date": today + timedelta(days=730),
            "naat_role": "מוביל חוסן מדורי",
            "awards": "מצטיין יחידה 2025",
            "notes": "מנהיג טבעי, שולט בכל שרשרת הסג\"ח. להקפיד איתו על האצלת סמכויות.",
            "last_1on1_date": today - timedelta(days=20),
            "personal_goals": "הובלת מודל זיהוי אנומליות, חניכת שני אלגוריתמאים צעירים"
        },
        {
            "full_name": "נועה כהן",
            "team": "צוות 1",
            "role": "חוקרת AI ואלגוריתמים",
            "population": "סדיר",
            "rank": "סמ\"לת",
            "city": "תל אביב",
            "education": "תואר ראשון במדמ\"ח (הפתוחה)",
            "welfare": "פטור משמרות לילה",
            "release_date": today + timedelta(days=140),
            "naat_role": "אחראית קליטת עובדים (Buddy)",
            "awards": "מצטיינת מערך 2026",
            "notes": "מבריקה, מתקרבת לשחרור, מומלץ לבדוק אפשרות לקבע.",
            "last_1on1_date": today - timedelta(days=45),  # באיחור לשיחה!
            "personal_goals": "כתיבת מאמר פנימי על מודלי עיבוד שפה, החלטה לגבי קבע"
        },
        {
            "full_name": "רועי ברק",
            "team": "צוות 1",
            "role": "אלגוריתמאי Computer Vision",
            "population": "סדיר",
            "rank": "סמל",
            "city": "פתח תקווה",
            "education": "עתודה טכנולוגית",
            "welfare": "ללא",
            "release_date": today + timedelta(days=365),
            "naat_role": "אחראי ציוד וחדרי שרתים",
            "awards": "ללא",
            "notes": "מקצועי מאוד בקוד, צריך שיפור בתקשורת מול צרכני הקצה.",
            "last_1on1_date": today - timedelta(days=15),
            "personal_goals": "שיפור מהירות הסקת המודלים ב-30%"
        },
        {
            "full_name": "פרופ' אהרון כץ",
            "team": "צוות 1",
            "role": "יועץ אלגוריתמיקה בכיר",
            "population": "יועץ",
            "rank": "אזרח",
            "city": "הרצליה",
            "education": "דוקטורט באלגוריתמים גיאוגרפיים",
            "welfare": "ללא",
            "release_date": today + timedelta(days=180),
            "naat_role": "מנחה אקדמי מדורי",
            "awards": "ללא",
            "notes": "עובד יומיים בשבוע, מייעץ בפתרונות עומק מתמטיים.",
            "last_1on1_date": today - timedelta(days=60),
            "personal_goals": "ליווי ארכיטקטורת מודל סג\"ח הדור הבא"
        },
        {
            "full_name": "עמית שפירא",
            "team": "צוות 1",
            "role": "אלגוריתמאי מילואים",
            "population": "מילואים",
            "rank": "רס\"ן (מיל')",
            "city": "כפר סבא",
            "education": "Senior AI Researcher בהייטק",
            "welfare": "ללא",
            "release_date": None,
            "naat_role": "חניכת עתודאים",
            "awards": "אות מלחמת חרבות ברזל",
            "notes": "מגיע יום בשבוע למילואים רציפים, נכס של ידע.",
            "last_1on1_date": today - timedelta(days=30),
            "personal_goals": "סגירת פערים ארכיטקטוניים"
        },
        {
            "full_name": "טל גולן",
            "team": "צוות 1",
            "role": "מפתח אלגוריתמים מתחיל",
            "population": "סדיר",
            "rank": "רב\"ט",
            "city": "חיפה",
            "education": "בוגר קורס תכנות בסמ\"ח",
            "welfare": "סיוע כלכלי ת\"ש",
            "release_date": today + timedelta(days=600),
            "naat_role": "עוזר אחראי הוואי",
            "awards": "ללא",
            "notes": "נקלט לפני 3 חודשים, לעקוב אחר מיצוי זכויות ת\"ש (חובת פיקוד).",
            "last_1on1_date": today - timedelta(days=10),
            "personal_goals": "השלמת חוזה קליטה, כניסה לעבודה עצמאית"
        },

        # --- צוות 2: הנדסת תוכנה ותשתיות ליבה (6 אנשים) ---
        {
            "full_name": "דנה מזרחי",
            "team": "צוות 2",
            "role": "רש\"צית Backend ותשתיות",
            "population": "קבע",
            "rank": "סרן",
            "city": "גבעתיים",
            "education": "תואר ראשון הנדסת תוכנה (בן גוריון)",
            "welfare": "ללא",
            "release_date": today + timedelta(days=500),
            "naat_role": "אחראית הדרכות טכנולוגיות",
            "awards": "מצטיינת רע\"ן 2024",
            "notes": "מובילה מעולה, מקפידה על אפס חוב טכנולוגי שקוף.",
            "last_1on1_date": today - timedelta(days=12),
            "personal_goals": "מעבר למיקרו-סרוויסים מלא, שיפור זמני תגובה של ה-DB"
        },
        {
            "full_name": "אורי פרידמן",
            "team": "צוות 2",
            "role": "מפתח Backend בכיר",
            "population": "סדיר",
            "rank": "סמ\"ר",
            "city": "רמת גן",
            "education": "לימודי מדמ\"ח באו\"פ",
            "welfare": "ללא",
            "release_date": today + timedelta(days=90),  # שחרור קרוב!
            "naat_role": "מנהל ספריות ליבה ו-CI",
            "awards": "ללא",
            "notes": "משתחרר בעוד 3 חודשים, חובה לוודא העברת מקל מסודרת ב-Confluence.",
            "last_1on1_date": today - timedelta(days=18),
            "personal_goals": "סיום תיעוד כל מודולי הליבה, העברת חפיפה"
        },
        {
            "full_name": "יונתן אלבז",
            "team": "צוות 2",
            "role": "מפתח Fullstack",
            "population": "סדיר",
            "rank": "סמל",
            "city": "אשדוד",
            "education": "בוגר בסמ\"ח",
            "welfare": "סיוע בשכר דירה",
            "release_date": today + timedelta(days=400),
            "naat_role": "אחראי הוואי ותרבות מדורי",
            "awards": "ללא",
            "notes": "מרים את המורל במדור, עובד מצוין ומדויק.",
            "last_1on1_date": today - timedelta(days=25),
            "personal_goals": "פיתוח כלי ניטור פנימיים למדור"
        },
        {
            "full_name": "גיא שמש",
            "team": "צוות 2",
            "role": "יועץ ארכיטקטורת נתונים",
            "population": "יועץ",
            "rank": "אזרח",
            "city": "תל אביב",
            "education": "B.Sc בהנדסת מערכות מידע",
            "welfare": "ללא",
            "release_date": today + timedelta(days=200),
            "naat_role": "ליווי ארכיטקטוני",
            "awards": "ללא",
            "notes": "מומחה PostgreSQL ו-Kafka. תומך בצוותי הפיתוח.",
            "last_1on1_date": today - timedelta(days=50),
            "personal_goals": "בניית תשתית שרידות נתונים למדור"
        },
        {
            "full_name": "סיוון לדרמן",
            "team": "צוות 2",
            "role": "מפתחת Backend",
            "population": "סדיר",
            "rank": "סמ\"לת",
            "city": "רעננה",
            "education": "בגרות מדעית מוגברת",
            "welfare": "ללא",
            "release_date": today + timedelta(days=300),
            "naat_role": "אחראית ספרייה מקצועית",
            "awards": "ללא",
            "notes": "לומדת מהר, מובילה את נושא ה-Code Reviews הקפדניים.",
            "last_1on1_date": today - timedelta(days=28),
            "personal_goals": "שליטה מלאה ב-FastAPI ובדיקות עומסים"
        },
        {
            "full_name": "ליאור חסון",
            "team": "צוות 2",
            "role": "מהנדס מילואים מומחה ביצועים",
            "population": "מילואים",
            "rank": "סרן (מיל')",
            "city": "הוד השרון",
            "education": "Principal Engineer בחברת ענן",
            "welfare": "ללא",
            "release_date": None,
            "naat_role": "מנטור טכנולוגי",
            "awards": "ללא",
            "notes": "מתגייס בימי חמישי ובחירום לפתרון צווארי בקבוק.",
            "last_1on1_date": today - timedelta(days=35),
            "personal_goals": "אופטימיזציית שאילתות סג\"ח כבדות"
        },

        # --- צוות 3: מחקר מודיעיני ואיסוף (6 אנשים) ---
        {
            "full_name": "מיכל הדס",
            "team": "צוות 3",
            "role": "רש\"צית מחקר מודיעיני",
            "population": "קבע",
            "rank": "סרן",
            "city": "ירושלים",
            "education": "תואר ראשון במזרח תיכון וגאוגרפיה",
            "welfare": "ללא",
            "release_date": today + timedelta(days=650),
            "naat_role": "אחראית קשרי צרכני קצה",
            "awards": "מצטיינת ראש אמ\"ן 2025",
            "notes": "מבינה לעומק את צרכן הקצה. מקפידה על מועילות מול יעילות.",
            "last_1on1_date": today - timedelta(days=14),
            "personal_goals": "העמקת הקשר מול חמ\"לי האוגדות"
        },
        {
            "full_name": "דניאל ישראלי",
            "team": "צוות 3",
            "role": "חוקר סג\"ח בכיר",
            "population": "סדיר",
            "rank": "סמ\"ר",
            "city": "ירושלים",
            "education": "קורס חוקרי מודיעין מתקדם",
            "welfare": "סיוע כלכלי חודשי",
            "release_date": today + timedelta(days=220),
            "naat_role": "אחראי חפיפות מחקר",
            "awards": "ללא",
            "notes": "חוקר מעמיק, לוודא קבלת מלוא זכויות הת\"ש.",
            "last_1on1_date": today - timedelta(days=22),
            "personal_goals": "פיתוח מתודולוגיית הצלבת שכבות מידע"
        },
        {
            "full_name": "שירן ביטון",
            "team": "צוות 3",
            "role": "חוקרת שטח וסג\"ח",
            "population": "סדיר",
            "rank": "סמל",
            "city": "באר שבע",
            "education": "תיכון מורחב גאוגרפיה ומחשבים",
            "welfare": "ללא",
            "release_date": today + timedelta(days=480),
            "naat_role": "אחראית רווחה מדורית",
            "awards": "ללא",
            "notes": "יסודית מאוד, מחוברת לחיילים.",
            "last_1on1_date": today - timedelta(days=16),
            "personal_goals": "הובלת מחקר תקופתי על גזרת הצפון"
        },
        {
            "full_name": "אליעזר שטרן",
            "team": "צוות 3",
            "role": "חוקר מילואים בכיר",
            "population": "מילואים",
            "rank": "רס\"ם (מיל')",
            "city": "בית שמש",
            "education": "חוקר גאופוליטי",
            "welfare": "ללא",
            "release_date": None,
            "naat_role": "חניכה מחקרית",
            "awards": "ללא",
            "notes": "זמין תמיד, עמוד תווך בהבנת השטח.",
            "last_1on1_date": today - timedelta(days=40),
            "personal_goals": "עדכון תורת המחקר המדורית"
        },
        {
            "full_name": "קרן ארגוב",
            "team": "צוות 3",
            "role": "חוקרת נתונים ואיסוף",
            "population": "סדיר",
            "rank": "סמ\"לת",
            "city": "נתניה",
            "education": "סטודנטית למדעי הנתונים (או\"פ)",
            "welfare": "ללא",
            "release_date": today + timedelta(days=190),
            "naat_role": "אחראית ניוזלטר מקצועי",
            "awards": "ללא",
            "notes": "חרוצה, מנהלת את הקשר מול גורמי האיסוף השכנים.",
            "last_1on1_date": today - timedelta(days=32),
            "personal_goals": "אוטומציה של איסוף דוחות מודיעין"
        },
        {
            "full_name": "אלון צור",
            "team": "צוות 3",
            "role": "חוקר סג\"ח צעיר",
            "population": "סדיר",
            "rank": "טוראי",
            "city": "חולון",
            "education": "בוגר קורס מודיעין",
            "welfare": "ללא",
            "release_date": today + timedelta(days=700),
            "naat_role": "עוזר ציוד",
            "awards": "ללא",
            "notes": "חייל חדש (נקלט החודש). לוודא שביצע סיור בשרשרת הערך והוצמד לו Buddy!",
            "last_1on1_date": today - timedelta(days=5),
            "personal_goals": "השלמת תוכנית קליטה מדורית (שבוע 3)"
        },

        # --- צוות 4: פלטפורמות וממשקי קצה (6 אנשים) ---
        {
            "full_name": "רן אביטל",
            "team": "צוות 4",
            "role": "רש\"צ Frontend ומוצר",
            "population": "קבע",
            "rank": "סגן",
            "city": "ראשון לציון",
            "education": "תואר ראשון מדמ\"ח ומערכות מידע",
            "welfare": "ללא",
            "release_date": today + timedelta(days=450),
            "naat_role": "מנהל חווית משתמש מדורית",
            "awards": "מצטיין ענף 2025",
            "notes": "שם דגש חזק על חווית הצרכן בקצה, מקיים מפגשים חודשיים.",
            "last_1on1_date": today - timedelta(days=19),
            "personal_goals": "שדרוג ממשק המערכת המבצעית ל-React 19"
        },
        {
            "full_name": "מיה קליין",
            "team": "צוות 4",
            "role": "מפתחת Frontend ראשית",
            "population": "סדיר",
            "rank": "סמ\"לת",
            "city": "כפר יונה",
            "education": "לימודי עיצוב ופיתוח ווב",
            "welfare": "ללא",
            "release_date": today + timedelta(days=110),
            "naat_role": "מעצבת תוצרי המדור",
            "awards": "ללא",
            "notes": "כישרון גדול, מתכננת שחרור בקרוב, כדאי להציע קבע קצר.",
            "last_1on1_date": today - timedelta(days=24),
            "personal_goals": "בניית ספריית קומפוננטות UI אחידה למדור"
        },
        {
            "full_name": "ערן שרעבי",
            "team": "צוות 4",
            "role": "מפתח UI/GIS",
            "population": "סדיר",
            "rank": "סמל",
            "city": "מודיעין",
            "education": "בוגר מכללת הנדסאים",
            "welfare": "פטור פעילות גופנית עקב פציעה",
            "release_date": today + timedelta(days=320),
            "naat_role": "אחראי תחזוקת משרד הרמ\"ד",
            "awards": "ללא",
            "notes": "מקצוען במפות ו-GIS, שקט ומסור.",
            "last_1on1_date": today - timedelta(days=21),
            "personal_goals": "שיפור ביצועי רינדור שכבות גאוגרפיות"
        },
        {
            "full_name": "ספיר אלקיים",
            "team": "צוות 4",
            "role": "מפתחת Fullstack",
            "population": "סדיר",
            "rank": "סמ\"לת",
            "city": "קריית אונו",
            "education": "תואר במדעי המחשב (במהלך השירות)",
            "welfare": "אישור עבודה",
            "release_date": today + timedelta(days=280),
            "naat_role": "אחראית לוח ימי הולדת וגיבוש",
            "awards": "ללא",
            "notes": "משלבת לימודים ועבודה, עומדת ביעדים בצורה מרשימה.",
            "last_1on1_date": today - timedelta(days=17),
            "personal_goals": "השלמת 2 קורסים באקדמיה, הובלת פיצ'ר התראות"
        },
        {
            "full_name": "בנימין גולדשטיין",
            "team": "צוות 4",
            "role": "יועץ חווית משתמש (UX)",
            "population": "יועץ",
            "rank": "אזרח",
            "city": "תל אביב",
            "education": "M.Des בעיצוב תעשייתי וממשקים",
            "welfare": "ללא",
            "release_date": today + timedelta(days=150),
            "naat_role": "הנחיית עיצוב",
            "awards": "ללא",
            "notes": "מביא סטנדרט בינלאומי לעיצוב המערכות הצבאיות.",
            "last_1on1_date": today - timedelta(days=45),
            "personal_goals": "הטמעת דיזיין סיסטם חדש"
        },
        {
            "full_name": "אורן זיו",
            "team": "צוות 4",
            "role": "מפתח Web מילואים",
            "population": "מילואים",
            "rank": "סגן (מיל')",
            "city": "שוהם",
            "education": "Tech Lead בסטארטאפ",
            "welfare": "ללא",
            "release_date": None,
            "naat_role": "ייעוץ ארכיטקטורת Web",
            "awards": "ללא",
            "notes": "תורם רבות לקוד איכותי ולמניעת באגים חוזרים.",
            "last_1on1_date": today - timedelta(days=33),
            "personal_goals": "סיוע במעבר ל-Microfrontends"
        },

        # --- צוות 5: DevOps, ענן ואיכות (6 אנשים) ---
        {
            "full_name": "תומר שוורץ",
            "team": "צוות 5",
            "role": "רש\"צ DevOps ואיכות",
            "population": "קבע",
            "rank": "סרן",
            "city": "רמת השרון",
            "education": "תואר ראשון מדמ\"ח",
            "welfare": "ללא",
            "release_date": today + timedelta(days=800),
            "naat_role": "ממונה אבטחת מידע מדורי",
            "awards": "מצטיין יחידתי",
            "notes": "שומר הסף של האיכות: CI מלא, טסטים אוטומטיים ואפס נפילות.",
            "last_1on1_date": today - timedelta(days=11),
            "personal_goals": "העלאת כיסוי הטסטים האוטומטיים ל-85% בכל המדור"
        },
        {
            "full_name": "מאיה שלום",
            "team": "צוות 5",
            "role": "מהנדסת DevOps וענן",
            "population": "סדיר",
            "rank": "סמ\"לת",
            "city": "פתח תקווה",
            "education": "הסמכות Kubernetes ו-AWS",
            "welfare": "ללא",
            "release_date": today + timedelta(days=210),
            "naat_role": "אחראית ניטור והתראות מבצעיות",
            "awards": "ללא",
            "notes": "מקצועית ביותר, מתפעלת את כל קווי ה-CI/CD של המדור.",
            "last_1on1_date": today - timedelta(days=13),
            "personal_goals": "העברת סביבות הבדיקה ל-ArgoCD"
        },
        {
            "full_name": "מתן רז",
            "team": "צוות 5",
            "role": "מהנדס בדיקות ואוטומציה (QA)",
            "population": "סדיר",
            "rank": "סמל",
            "city": "בת ים",
            "education": "קורס QA צבאי מתקדם",
            "welfare": "ללא",
            "release_date": today + timedelta(days=340),
            "naat_role": "אחראי ימי ספורט מדוריים",
            "awards": "ללא",
            "notes": "רודף באגים בעקשנות, מיישם את עקרון Blameless Post-Mortem.",
            "last_1on1_date": today - timedelta(days=29),
            "personal_goals": "אוטומציה לבדיקות קצה-לקצה (E2E)"
        },
        {
            "full_name": "אביב לנקרי",
            "team": "צוות 5",
            "role": "מהנדס אבטחת מידע ו-SecOps",
            "population": "סדיר",
            "rank": "סמל",
            "city": "יבנה",
            "education": "בוגר קורס מגן בסייבר",
            "welfare": "סיוע ת\"ש משפחתי",
            "release_date": today + timedelta(days=410),
            "naat_role": "אחראי ציוד חירום",
            "awards": "ללא",
            "notes": "אחראי ועירני. לוודא חלוקת תלושי חג/סיוע.",
            "last_1on1_date": today - timedelta(days=26),
            "personal_goals": "סריקת פגיעויות אוטומטית בכל Pull Request"
        },
        {
            "full_name": "רון דרור",
            "team": "צוות 5",
            "role": "מומחה ענן ותשתיות מילואים",
            "population": "מילואים",
            "rank": "רס\"ן (מיל')",
            "city": "תל מונד",
            "education": "VP R&D בתעשייה",
            "welfare": "ללא",
            "release_date": None,
            "naat_role": "יועץ אסטרטגיה טכנולוגית",
            "awards": "צל\"ש אלוף",
            "notes": "דמות השראה לחיילים הצעירים, מחבר לנעשה בתעשייה.",
            "last_1on1_date": today - timedelta(days=38),
            "personal_goals": "הכנת המדור לארכיטקטורת ענן רב-אזורית"
        },
        {
            "full_name": "שיר אזולאי",
            "team": "צוות 5",
            "role": "מפתחת כלי אוטומציה",
            "population": "סדיר",
            "rank": "רב\"ט",
            "city": "אשקלון",
            "education": "הנדסאית תוכנה",
            "welfare": "ללא",
            "release_date": today + timedelta(days=580),
            "naat_role": "עוזרת אחראית קליטה",
            "awards": "ללא",
            "notes": "חיילת מוכשרת, מתקדמת יפה בחניכה האישית.",
            "last_1on1_date": today - timedelta(days=9),
            "personal_goals": "בניית בוט פנימי לניהול שחרור גרסאות"
        }
    ]

    for s_dict in soldiers_data:
        soldier = Soldier(**s_dict)
        db.add(soldier)
    db.commit()

    # Tasks with Tagab deadlines
    tasks_data = [
        {
            "title": "סגירת יומן לשבועיים קדימה (SOP חמישי)",
            "team": "רוחבי מדור",
            "priority": 1,
            "attention_level": "גדולה",
            "tagab_date": today + timedelta(days=(3 - today.weekday()) % 7), # חמישי הקרוב
            "status": "בטיפול",
            "blockers": "אין",
            "ramad_notes": "מה שלא ביומן לא קורה! לשריין יציאה מוקדמת עם הילדות וזמן ללכלך ידיים בקוד.",
            "is_ramad_personal": True
        },
        {
            "title": "שיחת חניכה עומק עם נועה כהן (איחור של 45 יום)",
            "team": "צוות 1",
            "priority": 1,
            "attention_level": "גדולה",
            "tagab_date": today + timedelta(days=2),
            "status": "פתוח",
            "blockers": "לבדוק מול משא\"ן אפשרות לתקן קבע",
            "ramad_notes": "החיילת מתקרבת לשחרור, מבריקה. חובת פיקוד לקיים שיחה דוגרית.",
            "is_ramad_personal": True
        },
        {
            "title": "מפגש שביעות רצון חודשי מול צרכני הקצה (חמ\"ל צפון)",
            "team": "צוות 3",
            "priority": 1,
            "attention_level": "בינונית",
            "tagab_date": today + timedelta(days=5),
            "status": "בטיפול",
            "blockers": "תיאום לו\"ז מול קצין האג\"ם",
            "ramad_notes": "הצגת תוצרים ומדדי טלמטריה רציפים (DAU/MAU). מועילות מול יעילות!",
            "is_ramad_personal": True
        },
        {
            "title": "ביקורת Red Lines על פרויקט עיבוד סג\"ח v2",
            "team": "צוות 1",
            "priority": 2,
            "attention_level": "גדולה",
            "tagab_date": today + timedelta(days=7),
            "status": "בטיפול",
            "blockers": "אין",
            "ramad_notes": "האויב של האחריות הוא אחריות מקיפה: לוודא הרמטיות ויציבות לפני הוספת פיצ'רים חדשים.",
            "is_ramad_personal": True
        },
        {
            "title": "בדיקת חוב טכנולוגי בג'ירה עבור צוות 2",
            "team": "צוות 2",
            "priority": 2,
            "attention_level": "בינונית",
            "tagab_date": today + timedelta(days=4),
            "status": "בטיפול",
            "blockers": "אין",
            "ramad_notes": "אין חוב טכנולוגי שקוף. כל מעקף חייב להיכנס עם תאריך תיקון מוגדר.",
            "is_ramad_personal": True
        },
        {
            "title": "תוכנית קליטה וסיור בשרשרת הערך לאלון צור",
            "team": "צוות 3",
            "priority": 1,
            "attention_level": "בינונית",
            "tagab_date": today + timedelta(days=3),
            "status": "בטיפול",
            "blockers": "אין",
            "ramad_notes": "ערכת מסיפור לערך: לוודא שהחייל החדש עבר סיור עד הצרכן בקצה והוצמד Buddy.",
            "is_ramad_personal": True
        }
    ]

    for t_dict in tasks_data:
        task = Task(**t_dict)
        db.add(task)
    db.commit()

    # Cadence Routines (from doctrine.md Chapter 6)
    cadences = [
        {"name": "סיבוב במדור (נוכח ונחמד)", "frequency": "יומי", "notes": "סיבוב נוכחות, נגישות וחיוך בין 5 הצוותים"},
        {"name": "סנכרון רש\"צים (30 דק')", "frequency": "שבועי", "notes": "סטטוס משימות, תעדוף וסיוע בחסמים"},
        {"name": "תכנון לו\"ז וזמן אישי", "frequency": "שבועי (חמישי)", "notes": "תכנון שבועיים קדימה ושריון זמן ללכלך ידיים בקוד"},
        {"name": "תחקור עצמי לרמ\"ד", "frequency": "דו-שבועי (30 דק')", "notes": "התחככות עצמית: אוטומט, נחישות ומקצועיות, ראיית אנשים"},
        {"name": "מפגש שביעות רצון צרכנים", "frequency": "חודשי", "notes": "דיאלוג פרונטלי מול צרכני הקצה וטלמטריה"},
        {"name": "שיחות 1-על-1 וחניכה", "frequency": "חודשי", "notes": "שיחת עומק על פיתוח אישי, חוזה חניכה ומשוב"},
        {"name": "מפגש מדורי", "frequency": "חודשי (30-45 דק')", "notes": "עדכון רמ\"ד, חיבור לסג\"ח וחגיגת הצלחות וימי הולדת"}
    ]

    for c_dict in cadences:
        cadence = CadenceRoutine(**c_dict)
        db.add(cadence)
    db.commit()

    # Initial reflection log
    reflection = ReflectionLog(
        review_date=today - timedelta(days=14),
        energy_score=8,
        preservation_points="1. שמירה עקבית על יום הילדות ביומן.\n2. מתן גב פיקודי מלא לרש\"צ צוות 1 מול גורמי חוץ.",
        improvement_points="1. להקפיד על סיבוב יומי במדור גם בימים לחוצים.\n2. לעצור הוספת פיצ'רים בצוות 2 עד ייצוב הבאגים החוזרים.",
        raw_dialogue="תחקור דו-שבועי פתיחה - בדיקת עמידה בקווים אדומים."
    )
    db.add(reflection)
    db.commit()

    print(f"Seeded 30 soldiers, {len(tasks_data)} tasks, and cadences successfully.")
    db.close()

if __name__ == "__main__":
    seed_database()
