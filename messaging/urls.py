from django.urls import path

from .views import (
    ConversationDetailView,
    ConversationListCreateView,
    ConversationMessageView,
    ConversationRecipientListView,
)


urlpatterns = [
    path("", ConversationListCreateView.as_view(), name="conversation-list-create"),
    path("recipients/", ConversationRecipientListView.as_view(), name="conversation-recipients"),
    path("<int:conversation_id>/", ConversationDetailView.as_view(), name="conversation-detail"),
    path("<int:conversation_id>/messages/", ConversationMessageView.as_view(), name="conversation-messages"),
]
