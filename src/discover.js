import { config } from './config.js';
import { source } from './source/index.js';
import { getCourses, selectContentFolders, collectFiles } from './source/courses.js';

// Returns [{ area, course, files: [...] }] using all our folder rules
export async function discoverCourses(onProgress = () => {}) {
  const result = [];
  for (const area of await source.getAreas()) {
    const areaCfg = config.areas.find((a) => a.name === area.name);
    const courses = await getCourses({ ...area, ...areaCfg });

    for (const course of courses) {
      const label = course.category ? `${course.category} › ${course.name}` : course.name;
      const { folders, warnings } = await selectContentFolders(course, areaCfg);
      const files = (await Promise.all(
        folders.map((f) => collectFiles(f.ref, f.name, warnings))
      )).flat();

      onProgress(label, files.length);
      result.push({ area: area.name, course: label, files, warnings });
    }
  }
  return result;
}