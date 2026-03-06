import ToolCard from "@/components/dashboard/tool-card";
import { toolCategories, tools } from "@/lib/tools/registry";

export default function ToolGrid() {
  return (
    <div className="space-y-10">
      {toolCategories.map((category) => {
        const items = tools.filter((tool) => tool.category === category.id);

        if (items.length === 0) return null;

        return (
          <section key={category.id}>
            <div className="mb-4">
              <h2 className="text-2xl font-semibold text-white">
                {category.title}
              </h2>
            </div>

            <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
              {items.map((tool) => (
                <ToolCard key={tool.id} tool={tool} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}
