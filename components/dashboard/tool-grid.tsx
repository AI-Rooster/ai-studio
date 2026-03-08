import ToolCard from "@/components/dashboard/tool-card";
import { tools } from "@/lib/tools/registry";

function formatCategoryLabel(category: string) {
  switch (category) {
    case "product-visuals":
      return "Product Visuals";
    case "motion":
      return "Motion";
    case "campaign-assets":
      return "Campaign Assets";
    case "avatar-tools":
      return "Avatar Tools";
    default:
      return category
        .split("-")
        .map((part) => part.charAt(0).toUpperCase() + part.slice(1))
        .join(" ");
  }
}

export default function ToolGrid() {
  const groupedTools = tools.reduce<Record<string, typeof tools>>((acc, tool) => {
    if (!acc[tool.category]) {
      acc[tool.category] = [];
    }
    acc[tool.category].push(tool);
    return acc;
  }, {});

  const orderedCategories = [
    "product-visuals",
    "motion",
    "campaign-assets",
    "avatar-tools",
    ...Object.keys(groupedTools).filter(
      (category) =>
        !["product-visuals", "motion", "campaign-assets", "avatar-tools"].includes(category)
    ),
  ].filter((category, index, array) => array.indexOf(category) === index);

  return (
    <div className="space-y-10">
      {orderedCategories.map((category) => {
        const categoryTools = groupedTools[category] ?? [];

        if (categoryTools.length === 0) return null;

        return (
          <section key={category}>
            <div className="mb-4">
              <h2 className="text-xl font-semibold text-white">
                {formatCategoryLabel(category)}
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {categoryTools.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}