from django.shortcuts import render
from rest_framework.generics import GenericAPIView
from authentication.serializers import RegisterSerializer,LoginSerializer 
from rest_framework import response,status
from django.contrib.auth import authenticate

# Create your views here.

class RegisterAPIView(GenericAPIView):
    serializer_class=RegisterSerializer

    def post(self,request): 
        user=request.data
        serializer=self.serializer_class(data=user)

        if serializer.is_valid():
            serializer.save()
            return response.Response({"data":serializer.data,"mssg":"New acc resgistered"},status=status.HTTP_201_CREATED)
        
        return response.Response({"data":serializer.errors,"mssg":"New acc not resgistered"},status=status.HTTP_400_BAD_REQUEST) 

class LoginAPIView(GenericAPIView):
    serializer_class=LoginSerializer

    def post(self,request): 
        user=request.data
        serializer=self.serializer_class(data=user)
        serializer.is_valid(raise_exception=True)

        return response({"data":serializer.data,"mssg":"sucessfully logged in"},status=status.HTTP_201_CREATED)
    


        

