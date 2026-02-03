-- ============================================
-- SEED DATA FOR GLASS QUIZZES
-- Run this in Supabase SQL Editor
-- ============================================

-- 1. Generate room code function (for PvP)
CREATE OR REPLACE FUNCTION generate_room_code()
RETURNS TEXT AS $$
DECLARE
  chars TEXT := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  result TEXT := '';
  i INTEGER;
BEGIN
  FOR i IN 1..6 LOOP
    result := result || substr(chars, floor(random() * length(chars) + 1)::int, 1);
  END LOOP;
  RETURN result;
END;
$$ LANGUAGE plpgsql;

-- 2. Can challenge user function (1 hour cooldown)
CREATE OR REPLACE FUNCTION can_challenge_user(challenger UUID, opponent UUID)
RETURNS BOOLEAN AS $$
DECLARE
  last_challenge TIMESTAMP;
BEGIN
  SELECT created_at INTO last_challenge
  FROM challenges
  WHERE challenger_id = challenger AND opponent_id = opponent
  ORDER BY created_at DESC
  LIMIT 1;
  
  IF last_challenge IS NULL THEN
    RETURN TRUE;
  END IF;
  
  RETURN (NOW() - last_challenge) > INTERVAL '1 hour';
END;
$$ LANGUAGE plpgsql;

-- 3. App settings table (if not exists)
CREATE TABLE IF NOT EXISTS app_settings (
  key TEXT PRIMARY KEY,
  value JSONB NOT NULL,
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW()
);

-- Insert default leaderboard config
INSERT INTO app_settings (key, value)
VALUES ('leaderboard_config', '{"season_duration_days": 30, "cup_thresholds": {"gold": 1000, "silver": 500, "bronze": 100}}')
ON CONFLICT (key) DO NOTHING;

-- ============================================
-- TEST QUIZZES
-- ============================================

-- Quiz 1: Тест на знание React
INSERT INTO quizzes (id, title, description, image_url, question_count, duration_seconds, is_published, participant_count, created_at)
VALUES (
  'a1b2c3d4-e5f6-7890-abcd-ef1234567890',
  'Насколько хорошо ты знаешь React?',
  'Проверь свои знания самой популярной библиотеки для фронтенда',
  'https://images.unsplash.com/photo-1633356122544-f134324a6cee?w=800',
  5,
  15,
  true,
  42,
  NOW() - INTERVAL '3 days'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  description = EXCLUDED.description,
  is_published = EXCLUDED.is_published;

-- Questions for Quiz 1
INSERT INTO questions (id, quiz_id, question_text, options, correct_answer, order_index)
VALUES 
  ('q1-1', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Что такое JSX?', '[{"text": "JavaScript XML"}, {"text": "Java Syntax Extension"}, {"text": "JSON XML"}, {"text": "JavaScript XHR"}]', 0, 0),
  ('q1-2', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Какой хук используется для состояния?', '[{"text": "useEffect"}, {"text": "useState"}, {"text": "useContext"}, {"text": "useReducer"}]', 1, 1),
  ('q1-3', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Что делает useEffect?', '[{"text": "Управляет состоянием"}, {"text": "Создает контекст"}, {"text": "Выполняет побочные эффекты"}, {"text": "Мемоизирует значения"}]', 2, 2),
  ('q1-4', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Как передать данные вниз по дереву?', '[{"text": "state"}, {"text": "props"}, {"text": "refs"}, {"text": "effects"}]', 1, 3),
  ('q1-5', 'a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'Что возвращает компонент?', '[{"text": "HTML"}, {"text": "JSX элементы"}, {"text": "Строку"}, {"text": "JSON"}]', 1, 4)
ON CONFLICT (id) DO NOTHING;

-- Quiz 2: IQ Тест
INSERT INTO quizzes (id, title, description, image_url, question_count, duration_seconds, is_published, participant_count, created_at)
VALUES (
  'b2c3d4e5-f6g7-8901-bcde-f12345678901',
  'Быстрый IQ тест',
  'Проверь свою логику за 60 секунд',
  'https://images.unsplash.com/photo-1507003211169-0a1dd7228f2d?w=800',
  5,
  12,
  true,
  128,
  NOW() - INTERVAL '1 day'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  is_published = EXCLUDED.is_published;

-- Questions for Quiz 2
INSERT INTO questions (id, quiz_id, question_text, options, correct_answer, order_index)
VALUES 
  ('q2-1', 'b2c3d4e5-f6g7-8901-bcde-f12345678901', 'Продолжи ряд: 2, 4, 8, 16, ?', '[{"text": "24"}, {"text": "32"}, {"text": "30"}, {"text": "20"}]', 1, 0),
  ('q2-2', 'b2c3d4e5-f6g7-8901-bcde-f12345678901', 'Если A > B, и B > C, то...', '[{"text": "A = C"}, {"text": "A < C"}, {"text": "A > C"}, {"text": "Невозможно определить"}]', 2, 1),
  ('q2-3', 'b2c3d4e5-f6g7-8901-bcde-f12345678901', 'Найди лишнее: яблоко, банан, морковь, апельсин', '[{"text": "яблоко"}, {"text": "банан"}, {"text": "морковь"}, {"text": "апельсин"}]', 2, 2),
  ('q2-4', 'b2c3d4e5-f6g7-8901-bcde-f12345678901', '12 × 12 = ?', '[{"text": "124"}, {"text": "144"}, {"text": "134"}, {"text": "154"}]', 1, 3),
  ('q2-5', 'b2c3d4e5-f6g7-8901-bcde-f12345678901', 'Сколько месяцев имеют 28 дней?', '[{"text": "1"}, {"text": "6"}, {"text": "12"}, {"text": "0"}]', 2, 4)
ON CONFLICT (id) DO NOTHING;

-- Quiz 3: Кино и сериалы
INSERT INTO quizzes (id, title, description, image_url, question_count, duration_seconds, is_published, participant_count, created_at)
VALUES (
  'c3d4e5f6-g7h8-9012-cdef-123456789012',
  'Угадай фильм по кадру',
  'Насколько хорошо ты знаешь кино?',
  'https://images.unsplash.com/photo-1489599849927-2ee91cede3ba?w=800',
  5,
  10,
  true,
  89,
  NOW() - INTERVAL '12 hours'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  is_published = EXCLUDED.is_published;

-- Questions for Quiz 3
INSERT INTO questions (id, quiz_id, question_text, options, correct_answer, order_index)
VALUES 
  ('q3-1', 'c3d4e5f6-g7h8-9012-cdef-123456789012', 'В каком году вышел "Титаник"?', '[{"text": "1995"}, {"text": "1997"}, {"text": "1999"}, {"text": "2000"}]', 1, 0),
  ('q3-2', 'c3d4e5f6-g7h8-9012-cdef-123456789012', 'Кто режиссер "Начало" (Inception)?', '[{"text": "Спилберг"}, {"text": "Нолан"}, {"text": "Скорсезе"}, {"text": "Тарантино"}]', 1, 1),
  ('q3-3', 'c3d4e5f6-g7h8-9012-cdef-123456789012', 'Сколько Оскаров у "Властелина колец: Возвращение короля"?', '[{"text": "9"}, {"text": "10"}, {"text": "11"}, {"text": "12"}]', 2, 2),
  ('q3-4', 'c3d4e5f6-g7h8-9012-cdef-123456789012', 'Кто играл Джокера в "Темном рыцаре"?', '[{"text": "Джек Николсон"}, {"text": "Хоакин Феникс"}, {"text": "Хит Леджер"}, {"text": "Джаред Лето"}]', 2, 3),
  ('q3-5', 'c3d4e5f6-g7h8-9012-cdef-123456789012', 'Какой фильм был первым полностью CGI?', '[{"text": "Шрек"}, {"text": "История игрушек"}, {"text": "В поисках Немо"}, {"text": "Корпорация монстров"}]', 1, 4)
ON CONFLICT (id) DO NOTHING;

-- Quiz 4: Музыка
INSERT INTO quizzes (id, title, description, image_url, question_count, duration_seconds, is_published, participant_count, created_at)
VALUES (
  'd4e5f6g7-h8i9-0123-defg-234567890123',
  'Музыкальная викторина',
  'Проверь знания о музыке и исполнителях',
  'https://images.unsplash.com/photo-1511379938547-c1f69419868d?w=800',
  5,
  15,
  true,
  67,
  NOW() - INTERVAL '6 hours'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  is_published = EXCLUDED.is_published;

-- Questions for Quiz 4
INSERT INTO questions (id, quiz_id, question_text, options, correct_answer, order_index)
VALUES 
  ('q4-1', 'd4e5f6g7-h8i9-0123-defg-234567890123', 'Кто написал "Богемскую рапсодию"?', '[{"text": "The Beatles"}, {"text": "Queen"}, {"text": "Led Zeppelin"}, {"text": "Pink Floyd"}]', 1, 0),
  ('q4-2', 'd4e5f6g7-h8i9-0123-defg-234567890123', 'Сколько струн на стандартной гитаре?', '[{"text": "4"}, {"text": "5"}, {"text": "6"}, {"text": "7"}]', 2, 1),
  ('q4-3', 'd4e5f6g7-h8i9-0123-defg-234567890123', 'Кто называется "Королем поп-музыки"?', '[{"text": "Элвис Пресли"}, {"text": "Майкл Джексон"}, {"text": "Принс"}, {"text": "Фредди Меркьюри"}]', 1, 2),
  ('q4-4', 'd4e5f6g7-h8i9-0123-defg-234567890123', 'Какой альбом самый продаваемый в истории?', '[{"text": "Thriller"}, {"text": "Back in Black"}, {"text": "The Dark Side of the Moon"}, {"text": "Abbey Road"}]', 0, 3),
  ('q4-5', 'd4e5f6g7-h8i9-0123-defg-234567890123', 'В каком году был основан Spotify?', '[{"text": "2004"}, {"text": "2006"}, {"text": "2008"}, {"text": "2010"}]', 1, 4)
ON CONFLICT (id) DO NOTHING;

-- Quiz 5: Наука
INSERT INTO quizzes (id, title, description, image_url, question_count, duration_seconds, is_published, participant_count, created_at)
VALUES (
  'e5f6g7h8-i9j0-1234-efgh-345678901234',
  'Научная викторина',
  'Факты о космосе, физике и биологии',
  'https://images.unsplash.com/photo-1507413245164-6160d8298b31?w=800',
  5,
  20,
  true,
  34,
  NOW() - INTERVAL '2 hours'
) ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  is_published = EXCLUDED.is_published;

-- Questions for Quiz 5
INSERT INTO questions (id, quiz_id, question_text, options, correct_answer, order_index)
VALUES 
  ('q5-1', 'e5f6g7h8-i9j0-1234-efgh-345678901234', 'Какая планета ближе всего к Солнцу?', '[{"text": "Венера"}, {"text": "Меркурий"}, {"text": "Марс"}, {"text": "Земля"}]', 1, 0),
  ('q5-2', 'e5f6g7h8-i9j0-1234-efgh-345678901234', 'Из чего состоит вода?', '[{"text": "H2O"}, {"text": "CO2"}, {"text": "NaCl"}, {"text": "O2"}]', 0, 1),
  ('q5-3', 'e5f6g7h8-i9j0-1234-efgh-345678901234', 'Скорость света приблизительно равна...', '[{"text": "300 км/с"}, {"text": "300 000 км/с"}, {"text": "3 000 км/с"}, {"text": "30 000 км/с"}]', 1, 2),
  ('q5-4', 'e5f6g7h8-i9j0-1234-efgh-345678901234', 'Сколько костей в теле взрослого человека?', '[{"text": "186"}, {"text": "206"}, {"text": "226"}, {"text": "246"}]', 1, 3),
  ('q5-5', 'e5f6g7h8-i9j0-1234-efgh-345678901234', 'Кто открыл пенициллин?', '[{"text": "Пастер"}, {"text": "Флеминг"}, {"text": "Кох"}, {"text": "Дженнер"}]', 1, 4)
ON CONFLICT (id) DO NOTHING;

-- ============================================
-- VERDICTS FOR ALL QUIZZES
-- ============================================

INSERT INTO verdicts (quiz_id, min_score, max_score, title, text)
VALUES
  -- React quiz verdicts
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 0, 1, '🌱 Новичок', 'Начни с документации React — впереди увлекательный путь!'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 2, 3, '📚 Ученик', 'Неплохо! Продолжай практиковаться.'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 4, 4, '💪 Профи', 'Отлично! Ты хорошо знаешь React.'),
  ('a1b2c3d4-e5f6-7890-abcd-ef1234567890', 5, 5, '🏆 Мастер', 'Вау! Ты настоящий React-гуру!'),
  
  -- IQ quiz verdicts
  ('b2c3d4e5-f6g7-8901-bcde-f12345678901', 0, 1, '🐢 Можно лучше', 'Попробуй еще раз, когда выспишься 😴'),
  ('b2c3d4e5-f6g7-8901-bcde-f12345678901', 2, 3, '🧠 Средний уровень', 'Неплохая логика!'),
  ('b2c3d4e5-f6g7-8901-bcde-f12345678901', 4, 4, '🎯 Умница', 'Отличный результат!'),
  ('b2c3d4e5-f6g7-8901-bcde-f12345678901', 5, 5, '🚀 Гений', 'Эйнштейн, ты ли это?'),
  
  -- Movie quiz verdicts
  ('c3d4e5f6-g7h8-9012-cdef-123456789012', 0, 1, '📺 Телезритель', 'Пора смотреть больше кино!'),
  ('c3d4e5f6-g7h8-9012-cdef-123456789012', 2, 3, '🎬 Любитель', 'Ты знаешь классику.'),
  ('c3d4e5f6-g7h8-9012-cdef-123456789012', 4, 4, '🎥 Киноман', 'Отличные знания кино!'),
  ('c3d4e5f6-g7h8-9012-cdef-123456789012', 5, 5, '🏆 Кинокритик', 'Ты — ходячая энциклопедия кино!'),
  
  -- Music quiz verdicts
  ('d4e5f6g7-h8i9-0123-defg-234567890123', 0, 1, '🔇 Тишина', 'Включи радио!'),
  ('d4e5f6g7-h8i9-0123-defg-234567890123', 2, 3, '🎵 Слушатель', 'Неплохо разбираешься в музыке.'),
  ('d4e5f6g7-h8i9-0123-defg-234567890123', 4, 4, '🎸 Меломан', 'Ты знаешь много о музыке!'),
  ('d4e5f6g7-h8i9-0123-defg-234567890123', 5, 5, '🎤 Рок-звезда', 'Легенда!'),
  
  -- Science quiz verdicts
  ('e5f6g7h8-i9j0-1234-efgh-345678901234', 0, 1, '🔬 Исследователь', 'Наука ждёт тебя!'),
  ('e5f6g7h8-i9j0-1234-efgh-345678901234', 2, 3, '📖 Студент', 'Хорошие базовые знания.'),
  ('e5f6g7h8-i9j0-1234-efgh-345678901234', 4, 4, '🧪 Учёный', 'Отличные знания!'),
  ('e5f6g7h8-i9j0-1234-efgh-345678901234', 5, 5, '🚀 Нобелевский лауреат', 'Невероятно!')
ON CONFLICT DO NOTHING;

-- ============================================
-- BANNERS
-- ============================================

INSERT INTO banners (id, title, description, image_url, link_url, link_type, is_active, display_order)
VALUES
  ('banner-1', '🎯 Квиз дня', 'Пройди и получи бонус!', 'https://images.unsplash.com/photo-1516321497487-e288fb19713f?w=800', '/quiz/a1b2c3d4-e5f6-7890-abcd-ef1234567890', 'internal', true, 0),
  ('banner-2', '🏆 Турнир недели', 'Соревнуйся с друзьями', 'https://images.unsplash.com/photo-1552674605-db6ffd4facb5?w=800', '/leaderboard', 'internal', true, 1),
  ('banner-3', '🎁 Пригласи друга', 'Получи 50 попкорнов', 'https://images.unsplash.com/photo-1521791136064-7986c2920216?w=800', '/profile', 'internal', true, 2)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  is_active = EXCLUDED.is_active;

-- ============================================
-- TASKS
-- ============================================

INSERT INTO tasks (id, title, description, reward_type, reward_amount, task_type, action_url, icon, is_active, display_order)
VALUES
  ('task-1', 'Подпишись на канал', 'Будь в курсе новых квизов', 'popcorns', 20, 'link', 'https://t.me/quipobot_news', '📢', true, 0),
  ('task-2', 'Пригласи друга', 'Отправь ссылку другу', 'popcorns', 50, 'referral', NULL, '👥', true, 1),
  ('task-3', 'Пройди 3 квиза', 'Заверши 3 любых квиза', 'popcorns', 30, 'achievement', NULL, '🎯', true, 2),
  ('task-4', 'Поставь лайк', 'Оцени любой квиз', 'popcorns', 5, 'achievement', NULL, '❤️', true, 3)
ON CONFLICT (id) DO UPDATE SET
  title = EXCLUDED.title,
  is_active = EXCLUDED.is_active;

-- ============================================
-- DONE!
-- ============================================
SELECT 'Seed data inserted successfully! 🎉' as status;
