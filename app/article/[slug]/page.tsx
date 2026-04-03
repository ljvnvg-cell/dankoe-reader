import { createServerClient } from "@/lib/supabase";
import { notFound } from "next/navigation";
import ArticleDetail from "./ArticleDetail";

export default async function ArticlePage({
  params,
}: {
  params: Promise<{ slug: string }>;
}) {
  const { slug } = await params;
  const supabase = createServerClient();

  const { data: article } = await supabase
    .from("articles")
    .select("*")
    .eq("slug", slug)
    .single();

  if (!article) {
    notFound();
  }

  return <ArticleDetail article={article} />;
}
