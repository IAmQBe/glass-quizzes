import { useQuery } from "@tanstack/react-query";
import { supabase } from "@/integrations/supabase/client";

export interface Banner {
  id: string;
  title: string;
  description: string | null;
  image_url: string;
  link_url: string | null;
  link_type: "internal" | "external";
  display_order: number;
}

export const useBanners = () => {
  return useQuery({
    queryKey: ["banners"],
    queryFn: async (): Promise<Banner[]> => {
      const { data, error } = await supabase
        .from("banners")
        .select("*")
        .eq("is_active", true)
        .order("display_order", { ascending: true });

      if (error) throw error;
      
      return (data || []).map(b => ({
        ...b,
        link_type: b.link_type as "internal" | "external"
      }));
    },
  });
};