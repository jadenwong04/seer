const mysqlx = require('@mysql/xdevapi');
const config = require('../../config.json')
require('dotenv').config();

const config = {
  user: process.env.MYSQL_USER,
  password: process.env.MYSQL_PW,
  host: process.env.MYSQL_HOST,
  port: process.env.MYSQL_PORT
};

module.exports = async function initialize_database() {
  const session = await mysqlx.getSession(config);

  await session.sql(`CREATE DATABASE IF NOT EXISTS ${process.env.MYSQL_DB}`)
    .execute();

  await session.sql(`USE ${process.env.MYSQL_DB}`)
    .execute();

  const initialize_table_queries = [
    `
      CREATE TABLE IF NOT EXISTS guild (
        guild_id      VARCHAR(100) NOT NULL,
        join_date     DATETIME NOT NULL DEFAULT NOW(),
        auth_role     VARCHAR(100) DEFAULT NULL,
        guild_expiry  DATETIME DEFAULT NULL
        PRIMARY KEY (guild_id)
      )
    `
    ,
    `
      CREATE TABLE IF NOT EXISTS banned_term (
        term_id     VARCHAR(100) NOT NULL,
        term        VARCHAR(255) NOT NULL
        PRIMARY KEY (term_id)
      );
    `
    ,
    `
      CREATE TABLE IF NOT EXISTS banned_guild_term (
        guild_id    VARCHAR(100) NOT NULL,
        term_id     VARCHAR(100) NOT NULL,
        max_offset  INT DEFAULT 0,
        PRIMARY KEY (guild_id, term_id),
        FOREIGN KEY (guild_id) REFERENCES guild(guild_id) ON DELETE CASCADE,
        FOREIGN KEY (term_id) REFERENCES banned_term(term_id)
      );
    `
  ]

  for (const initialize_table_query of initialize_table_queries) {
    await session.sql(initialize_table_query)
      .execute();
  }

  const event_scheduler_queries = [
    `
      CREATE EVENT delete_expired_guilds
      ON SCHEDULE EVERY ${config.guild_data_ttl.event_scheduler.quantity} ${config.guild_data_ttl.event_scheduler.unit}
      DO
        DELETE FROM guild WHERE guild_expiry <> NULL AND guild_expiry < NOW();
    `,
    `
      CREATE EVENT delete_expired_members
      ON SCHEDULE EVERY ${config.member_data_ttl.event_scheduler.quantity} ${config.member_data_ttl.event_scheduler.unit}
      DO
        DELETE FROM member WHERE member_expiry <> NULL AND member_expiry < NOW();
    `
  ]

  for (const event_scheduler_query of event_scheduler_queries) {
    await session.sql(event_scheduler_query)
      .execute();
  }

  console.log(`Initialized session for MySQL Database`);
  console.dir(session.inspect(), { depth: null, colors: true });

  return session;
}