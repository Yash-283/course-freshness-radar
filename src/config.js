import 'dotenv/config';

export const config = {
  source: process.env.SOURCE || 'local',
  localRoot: process.env.LOCAL_ROOT || './sample-sharepoint',

  // The only two folders the tool may read
  areas: [
    {
      name: 'Artificial Intelligence',
      idEnv: 'AI_COURSES_FOLDER_ID',
      courseDepth: 2,      // category › course
      includeSIG: true,    // SIG checked for AI courses
    },
    {
      name: 'Cloud Computing (AWS)',
      idEnv: 'AWS_COURSES_FOLDER_ID',
      courseDepth: 1,      // course folders sit directly here
      includeSIG: false,   // no SIG check for AWS
    },
  ],

  // Any folder whose name CONTAINS one of these is skipped, with everything inside it
  skipFolderWords: ['archive', 'external', 'recording', 'kick-off', 'kickoff'],

  // Files whose name contains one of these are skipped (duplicates)
  skipFileWords: [' - copy', '(copy)', 'copy of '],

  // File types we read
  fileTypes: ['.pptx', '.docx', '.pdf', '.md'],
  maxFileMB: 50,

  // How many SharePoint folders to read at the same time
  concurrency: 4,
};