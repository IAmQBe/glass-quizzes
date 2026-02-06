-- Increment participant_count on personality test completion
CREATE OR REPLACE FUNCTION public.update_personality_test_participant_count()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE public.personality_tests
  SET participant_count = participant_count + 1
  WHERE id = NEW.test_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER SET search_path = public;

DROP TRIGGER IF EXISTS on_personality_test_completion_insert ON public.personality_test_completions;
CREATE TRIGGER on_personality_test_completion_insert
AFTER INSERT ON public.personality_test_completions
FOR EACH ROW
EXECUTE FUNCTION public.update_personality_test_participant_count();
