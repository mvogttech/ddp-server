import pino from 'pino';

const logger = pino({
  level: process.env.LOG_LEVEL || 'info',
});

module.exports = (data) => {
  logger.info(data);
};
