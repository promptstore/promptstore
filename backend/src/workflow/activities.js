const createActivities = (analysisService, contentService) => ({

  async analyze(contentId) {
    const content = await contentService.getContentByContentId(contentId);
    const analysis = await analysisService.analyzeContent(content.text);
    await contentService.upsertContent({ ...content, analysis });
    return {
      contentId,
      text: content.text,
      analysis,
    }
  },

});

module.exports = { createActivities };
