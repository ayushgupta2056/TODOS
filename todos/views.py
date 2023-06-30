
from rest_framework.generics import CreateAPIView,ListAPIView,ListCreateAPIView
from .serializers import TodoSerializer
from rest_framework import permissions,filters
from .models import Todo
from rest_framework.generics import RetrieveUpdateDestroyAPIView
from django_filters.rest_framework import DjangoFilterBackend
from todos.paginations import CustomPageNumberPagination

# Create your views here.

class TodosAPIView(ListCreateAPIView):
    serializer_class= TodoSerializer
    permission_classes=(permissions.IsAuthenticated,)
    filter_backends=[DjangoFilterBackend,filters.SearchFilter]
    

    filterset_fields=['id','title','desc','is_completed'] 
    search_fields=['id','title','desc','is_completed']

    def perform_create(self, serializer):
        return serializer.save(owner=self.request.user)
    
    def get_queryset(self):
        return Todo.objects.filter(owner=self.request.user)
    

class TodoDetailAPIView(RetrieveUpdateDestroyAPIView):
    serializer_class= TodoSerializer
    permission_classes=(permissions.IsAuthenticated,)
    lookup_field='id'

    def get_queryset(self):
        return Todo.objects.filter(owner=self.request.user)
    
    
    
    




