import 'dotenv/config';

export const config = {
  // 'local' now; switch to 'graph' once IT gives access
  source: process.env.SOURCE || 'local',
  localRoot: process.env.LOCAL_ROOT || './sample-sharepoint',

  // The only two folders the tool may read
    areas: ['AI courses', 'AWS courses'],
      // The only two folders the tool may read (name + which .env ID belongs to it)
  areas: [
    { name: 'Artificial Intelligence', idEnv: 'AI_COURSES_FOLDER_ID' },
    { name: 'Cloud Computing (AWS)',   idEnv: 'AWS_COURSES_FOLDER_ID' },
  ],

  // Folders to always skip
  archiveNames: ['archive', 'old', 'backup'],

  // File types we read
  fileTypes: ['.pptx', '.docx', '.pdf', '.md'],
  maxFileMB: 50,
};