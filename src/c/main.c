#include <pebble.h>

#define MAX_GAMES 10
#define TITLE_LEN 40
#define SUBTITLE_LEN 80

enum {
  KEY_REQUEST_REFRESH = 0,
  KEY_MODE = 1,
  KEY_COUNT = 2,
  KEY_STATUS = 3,

  KEY_TITLE_0 = 10,
  KEY_SUBTITLE_0 = 11,
  KEY_TITLE_1 = 12,
  KEY_SUBTITLE_1 = 13,
  KEY_TITLE_2 = 14,
  KEY_SUBTITLE_2 = 15,
  KEY_TITLE_3 = 16,
  KEY_SUBTITLE_3 = 17,
  KEY_TITLE_4 = 18,
  KEY_SUBTITLE_4 = 19,
  KEY_TITLE_5 = 20,
  KEY_SUBTITLE_5 = 21,
  KEY_TITLE_6 = 22,
  KEY_SUBTITLE_6 = 23,
  KEY_TITLE_7 = 24,
  KEY_SUBTITLE_7 = 25,
  KEY_TITLE_8 = 26,
  KEY_SUBTITLE_8 = 27,
  KEY_TITLE_9 = 28,
  KEY_SUBTITLE_9 = 29
};

static Window *s_main_window;
static SimpleMenuLayer *s_menu_layer;

static SimpleMenuSection s_sections[1];
static SimpleMenuItem s_items[MAX_GAMES];

static char s_title_buffers[MAX_GAMES][TITLE_LEN];
static char s_subtitle_buffers[MAX_GAMES][SUBTITLE_LEN];

static char s_status_title[TITLE_LEN];
static char s_status_subtitle[SUBTITLE_LEN];
static char s_section_title[TITLE_LEN];

static int s_item_count = 0;

static void request_refresh(void);
static void rebuild_menu_layer(void);

static void rebuild_menu_layer(void) {
  Layer *window_layer;
  GRect bounds;

  if (!s_main_window) {
    return;
  }

  window_layer = window_get_root_layer(s_main_window);
  bounds = layer_get_bounds(window_layer);

  if (s_menu_layer) {
    simple_menu_layer_destroy(s_menu_layer);
    s_menu_layer = NULL;
  }

  s_sections[0].title = s_section_title;
  s_sections[0].items = s_items;
  s_sections[0].num_items = s_item_count;

  s_menu_layer = simple_menu_layer_create(bounds, s_main_window, s_sections, 1, NULL);
  layer_add_child(window_layer, simple_menu_layer_get_layer(s_menu_layer));
}

static void set_status(const char *title, const char *subtitle) {
  snprintf(s_section_title, sizeof(s_section_title), "%s", title);

  snprintf(s_status_title, sizeof(s_status_title), "%s", title);
  snprintf(s_status_subtitle, sizeof(s_status_subtitle), "%s", subtitle);

  s_items[0].title = s_status_title;
  s_items[0].subtitle = s_status_subtitle;
  s_items[0].callback = NULL;

  s_item_count = 1;

  s_sections[0].title = s_section_title;
  s_sections[0].items = s_items;
  s_sections[0].num_items = s_item_count;

  rebuild_menu_layer();
}

static void menu_select_callback(int index, void *ctx) {
  APP_LOG(APP_LOG_LEVEL_INFO, "Manual refresh requested from menu item %d", index);

  set_status("Refreshing...", "Fetching AFL scores");

  request_refresh();
}

static void update_menu_from_buffer(void) {
  int i;

  for (i = 0; i < s_item_count; i++) {
    s_items[i].callback = menu_select_callback;
  }

  s_sections[0].items = s_items;
  s_sections[0].num_items = s_item_count;

  rebuild_menu_layer();
}

static void inbox_received_callback(DictionaryIterator *iter, void *context) {
  Tuple *status_tuple;
  Tuple *count_tuple;
  int count;
  int i;

  status_tuple = dict_find(iter, KEY_STATUS);
  count_tuple = dict_find(iter, KEY_COUNT);

if (status_tuple) {
  APP_LOG(APP_LOG_LEVEL_INFO, "Status from phone: %s", status_tuple->value->cstring);

  if (status_tuple->value->cstring[0] != '\0') {
    snprintf(s_section_title, sizeof(s_section_title), "%s", status_tuple->value->cstring);
  } else {
    snprintf(s_section_title, sizeof(s_section_title), "%s", "AFL Live");
  }
} else {
  snprintf(s_section_title, sizeof(s_section_title), "%s", "AFL Live");
}

  count = 0;

  if (count_tuple) {
    count = (int)count_tuple->value->uint8;
  }

  if (count <= 0) {
    const char *msg = "No games found";

    if (status_tuple && status_tuple->value->cstring[0] != '\0') {
      msg = status_tuple->value->cstring;
    }

    set_status("AFL Live", msg);
    return;
  }

  if (count > MAX_GAMES) {
    count = MAX_GAMES;
  }

  for (i = 0; i < count; i++) {
    int title_key;
    int subtitle_key;
    Tuple *title_tuple;
    Tuple *subtitle_tuple;

    title_key = KEY_TITLE_0 + (i * 2);
    subtitle_key = KEY_SUBTITLE_0 + (i * 2);

    title_tuple = dict_find(iter, title_key);
    subtitle_tuple = dict_find(iter, subtitle_key);

    if (title_tuple && title_tuple->value->cstring[0] != '\0') {
      snprintf(s_title_buffers[i], TITLE_LEN, "%s", title_tuple->value->cstring);
    } else {
      snprintf(s_title_buffers[i], TITLE_LEN, "%s", "AFL Game");
    }

    if (subtitle_tuple && subtitle_tuple->value->cstring[0] != '\0') {
      snprintf(s_subtitle_buffers[i], SUBTITLE_LEN, "%s", subtitle_tuple->value->cstring);
    } else {
      snprintf(s_subtitle_buffers[i], SUBTITLE_LEN, "%s", "");
    }

    s_items[i].title = s_title_buffers[i];
    s_items[i].subtitle = s_subtitle_buffers[i];
    s_items[i].callback = menu_select_callback;
  }

  s_item_count = count;

  update_menu_from_buffer();
}

static void inbox_dropped_callback(AppMessageResult reason, void *context) {
  APP_LOG(APP_LOG_LEVEL_ERROR, "Inbox dropped message. Reason: %d", reason);

  set_status("Message error", "Inbox message dropped");
}

static void outbox_failed_callback(DictionaryIterator *iter, AppMessageResult reason, void *context) {
  APP_LOG(APP_LOG_LEVEL_ERROR, "Outbox send failed. Reason: %d", reason);
}

static void outbox_sent_callback(DictionaryIterator *iter, void *context) {
  APP_LOG(APP_LOG_LEVEL_INFO, "Outbox message sent");
}

static void request_refresh(void) {
  DictionaryIterator *iter;
  AppMessageResult result;

  result = app_message_outbox_begin(&iter);

  if (result != APP_MSG_OK) {
    APP_LOG(APP_LOG_LEVEL_ERROR, "Unable to begin outbox message. Result: %d", result);
    return;
  }

  dict_write_uint8(iter, KEY_REQUEST_REFRESH, 1);
  dict_write_end(iter);

  result = app_message_outbox_send();

  if (result != APP_MSG_OK) {
    APP_LOG(APP_LOG_LEVEL_ERROR, "Unable to send refresh request. Result: %d", result);
  }
}

static void main_window_load(Window *window) {
  snprintf(s_section_title, sizeof(s_section_title), "%s", "AFL Live");
  s_sections[0].title = s_section_title;
  s_sections[0].items = s_items;
  s_sections[0].num_items = 0;

  set_status("AFL Live", "Loading scores...");

  request_refresh();
}

static void main_window_unload(Window *window) {
  if (s_menu_layer) {
    simple_menu_layer_destroy(s_menu_layer);
    s_menu_layer = NULL;
  }
}

static void init(void) {
  app_message_register_inbox_received(inbox_received_callback);
  app_message_register_inbox_dropped(inbox_dropped_callback);
  app_message_register_outbox_failed(outbox_failed_callback);
  app_message_register_outbox_sent(outbox_sent_callback);

  app_message_open(2048, 2048);

  s_main_window = window_create();

  window_set_window_handlers(s_main_window, (WindowHandlers) {
    .load = main_window_load,
    .unload = main_window_unload
  });

  window_stack_push(s_main_window, true);
}

static void deinit(void) {
  if (s_main_window) {
    window_destroy(s_main_window);
    s_main_window = NULL;
  }
}

int main(void) {
  init();
  app_event_loop();
  deinit();
}