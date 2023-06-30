from rest_framework import serializers
from authentication.models import User
from django.contrib import auth
from rest_framework import exceptions

class RegisterSerializer(serializers.ModelSerializer):

    password= serializers.CharField(max_length=128,min_length=6,write_only=True)

    
    class Meta :
        model=User
        fields=('first_name','last_name','username','email','password')

    def create(self, validated_data):
        return User.objects.create_user(**validated_data)

        
class LoginSerializer(serializers.ModelSerializer):

    password= serializers.CharField(max_length=128,min_length=6,write_only=True)

    
    class Meta :
        model=User
        fields=('username','password')
    
    def validate(self, attrs):
        print("Running")
        username=attrs.get('username','')
        password=attrs.get('password','')
        
        print("ok")
        user=auth.authenticate(username=username,password=password)

        if not user:
            raise exceptions.AuthenticationFailed('Invalid credentials,"try again"')
        if not user.is_active:
            raise exceptions.AuthenticationFailed('Acc disabled')
        
        return attrs
