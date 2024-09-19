import type { Job } from 'bullmq';
import { last } from 'ramda';

import { getTime } from '@openpanel/common';
import {
  TABLE_NAMES,
  createEvent,
  eventBuffer,
  getEvents,
} from '@openpanel/db';
import { createLogger } from '@openpanel/logger';
import type { EventsQueuePayloadCreateSessionEnd } from '@openpanel/queue';

export async function createSessionEnd(
  job: Job<EventsQueuePayloadCreateSessionEnd>,
) {
  const logger = createLogger({
    name: 'job:create-session-end',
  }).child({
    payload: job.data.payload,
    jobId: job.id,
  });

  const payload = job.data.payload;
  const eventsInBuffer = await eventBuffer.findMany(
    (item) => item.session_id === payload.sessionId,
  );

  const sql = `
  SELECT * FROM ${TABLE_NAMES.events} 
  WHERE 
    session_id = '${payload.sessionId}' 
    ${payload.projectId ? `AND project_id = '${payload.projectId}' ` : ''}
    AND created_at >= (
      SELECT created_at 
      FROM ${TABLE_NAMES.events}
      WHERE 
        session_id = '${payload.sessionId}' 
        AND name = 'session_start'
        ${payload.projectId ? `AND project_id = '${payload.projectId}' ` : ''}
        AND created_at > now() - interval 24 HOUR
      ORDER BY created_at DESC
      LIMIT 1
    ) 
  ORDER BY created_at DESC
`;
  job.log(sql);
  const eventsInDb = await getEvents(sql);
  // sort last inserted first
  const events = [...eventsInBuffer, ...eventsInDb].sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );

  events.map((event, index) => {
    job.log(
      [
        `Index: ${index}`,
        `Event: ${event.name}`,
        `Created: ${event.createdAt.toISOString()}`,
        `DeviceId: ${event.deviceId}`,
        `Profile: ${event.profileId}`,
        `Path: ${event.path}`,
      ].join('\n'),
    );
  });

  const sessionDuration = events.reduce((acc, event) => {
    return acc + event.duration;
  }, 0);

  let sessionStart = events.find((event) => event.name === 'session_start');
  const lastEvent = events[0];
  const screenViews = events.filter((event) => event.name === 'screen_view');

  if (!sessionStart) {
    const firstScreenView = last(screenViews);

    if (!firstScreenView) {
      throw new Error('Could not found session_start or any screen_view');
    }

    logger.warn('Creating session_start since it was not found');

    sessionStart = {
      ...firstScreenView,
      name: 'session_start',
      createdAt: new Date(getTime(firstScreenView.createdAt) - 100),
    };

    await createEvent(sessionStart);
  }

  if (!lastEvent) {
    throw new Error('No last event found');
  }

  return createEvent({
    ...sessionStart,
    properties: {
      ...sessionStart.properties,
      __bounce: screenViews.length <= 1,
    },
    name: 'session_end',
    duration: sessionDuration,
    path: screenViews[0]?.path ?? '',
    createdAt: new Date(getTime(lastEvent?.createdAt) + 100),
  });
}
