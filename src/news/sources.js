export const NEWS_SOURCES = [
  {
    id: "aws-whats-new",
    vendor: "AWS",
    type: "rss",
    url: "https://aws.amazon.com/about-aws/whats-new/recent/feed/",
  },

  {
    id: "aws-training-cert",
    vendor: "AWS",
    type: "rss",
    url: "https://aws.amazon.com/blogs/training-and-certification/feed/",
  },

  {
    id: "github-changelog",
    vendor: "GitHub",
    type: "rss",
    url: "https://github.blog/changelog/feed/",
  },

  {
    id: "github-copilot",
    vendor: "GitHub",
    type: "rss",
    url: "https://github.blog/changelog/label/copilot/feed/",
  },

  {
    id: "claude-platform",
    vendor: "Anthropic",
    type: "dated-page",
    url: "https://platform.claude.com/docs/en/release-notes/api.md",
    link: "https://platform.claude.com/docs/en/release-notes/api",
  },

  {
    id: "claude-apps",
    vendor: "Anthropic",
    type: "dated-page",
    url: "https://support.claude.com/en/articles/12138966-release-notes",
  },

  {
    id: "claude-code",
    vendor: "Anthropic",
    type: "versioned-md",
    url: "https://raw.githubusercontent.com/anthropics/claude-code/main/CHANGELOG.md",
    link: "https://code.claude.com/docs/en/changelog",
  },
];
