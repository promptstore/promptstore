module.exports = {
  extends: ['react-app'],
  overrides:[
    {
      files: ['**/*.js'],
      rules: {
        'react-hooks/exhaustive-deps': 'off'
      }
    }
  ]
}